import { eq, desc, sql, and } from 'drizzle-orm';
import { projects, deployments, envVariables, domains } from '@fd/db';
import type { DbClient } from '@fd/db';
import type { CreateProjectInput, UpdateProjectInput, UpdateEnvVarsInput } from '@fd/shared';
import { PORT_RANGE_START, PORT_RANGE_END } from '@fd/shared';
import { encrypt, decrypt } from '../lib/crypto.js';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createUnit, stopService, deleteUnit } from '../lib/systemd.js';
import { removeRoute } from './proxy-service.js';

const encryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is not set');
  return key;
};

export function isPortAvailable(port: number): boolean {
  if (process.platform === 'darwin') return true;
  try {
    const output = execFileSync('ss', ['-tlnH'], { encoding: 'utf-8', timeout: 5000 });
    for (const line of output.split('\n')) {
      if (new RegExp(`:${port}\\s`).test(line)) {
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

export function allocatePort(db: DbClient): number {
  const usedPorts = db
    .select({ port: projects.port })
    .from(projects)
    .orderBy(projects.port)
    .all()
    .map((r) => r.port);

  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
    if (!usedPorts.includes(p) && isPortAvailable(p)) return p;
  }
  throw new Error(`No available ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`);
}

export function listProjects(db: DbClient) {
  const latestDeploy = db
    .select({
      projectId: deployments.projectId,
      maxCreatedAt: sql<string>`MAX(${deployments.createdAt})`.as('max_created_at'),
    })
    .from(deployments)
    .groupBy(deployments.projectId)
    .as('latest_deploy');

  const rows = db
    .select({
      project: projects,
      deployStatus: deployments.status,
      deployCommitSha: deployments.commitSha,
      deployCreatedAt: deployments.createdAt,
    })
    .from(projects)
    .leftJoin(latestDeploy, eq(projects.id, latestDeploy.projectId))
    .leftJoin(
      deployments,
      and(
        eq(deployments.projectId, latestDeploy.projectId),
        eq(deployments.createdAt, latestDeploy.maxCreatedAt),
      ),
    )
    .orderBy(desc(projects.createdAt))
    .all();

  return rows.map((r) => ({
    ...r.project,
    lastDeploy: r.deployStatus
      ? {
          status: r.deployStatus,
          commitSha: r.deployCommitSha,
          createdAt: r.deployCreatedAt,
        }
      : null,
  }));
}

export function getProject(db: DbClient, id: string) {
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return null;

  const projectDomains = db.select().from(domains).where(eq(domains.projectId, id)).all();

  return { ...project, domains: projectDomains };
}

export function createProject(db: DbClient, data: CreateProjectInput) {
  const port = allocatePort(db);
  const srcDir = `/var/www/${data.name}-src`;
  const runtimeDir = `/var/www/${data.name}`;
  const serviceName = `frostdeploy-${data.name}`;

  const created = db
    .insert(projects)
    .values({
      name: data.name,
      repoUrl: data.repoUrl,
      branch: data.branch ?? 'main',
      domain: data.domain ?? null,
      port,
      rootDir: data.rootDir ?? null,
      extraPath: data.extraPath ?? null,
      runUser: data.runUser ?? null,
      limitNofile: data.limitNofile ?? null,
      srcDir,
      runtimeDir,
      serviceName,
    })
    .returning()
    .get();

  if (data.envVars?.length) {
    const key = encryptionKey();
    db.insert(envVariables)
      .values(
        data.envVars.map((v) => ({
          projectId: created!.id,
          key: v.key,
          encryptedValue: encrypt(v.value, key),
          isSecret: v.isSecret ?? true,
        })),
      )
      .run();
  }

  // Task 7.3 — Create directories & systemd unit (fire-and-forget)
  try {
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(runtimeDir, { recursive: true });
  } catch (err) {
    console.warn(`[project] Failed to create directories for ${data.name}:`, err);
  }

  createUnit({
    name: data.name,
    runtimeDir,
    startCmd: 'npm start',
    port,
  }).catch((err) => {
    console.warn(`[project] Failed to create systemd unit for ${data.name}:`, err);
  });

  return created!;
}

export function updateProject(db: DbClient, id: string, data: UpdateProjectInput) {
  const existing = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!existing) return null;

  const { domain: _domain, ...updateData } = data;

  const updated = db
    .update(projects)
    .set({
      ...updateData,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(projects.id, id))
    .returning()
    .get();

  return updated!;
}

export async function deleteProject(db: DbClient, id: string): Promise<boolean> {
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return false;

  // Task 7.3 — Stop service & delete systemd unit
  try {
    await stopService(project.name);
  } catch (err) {
    console.warn(`[project] Failed to stop service for ${project.name}:`, err);
  }
  try {
    await deleteUnit(project.name);
  } catch (err) {
    console.warn(`[project] Failed to delete systemd unit for ${project.name}:`, err);
  }

  // Task 7.2 — Remove Caddy routes for all project domains
  const projectDomains = db.select().from(domains).where(eq(domains.projectId, id)).all();
  for (const d of projectDomains) {
    try {
      await removeRoute(d.domain);
    } catch (err) {
      console.warn(`[project] Failed to remove Caddy route for ${d.domain}:`, err);
    }
  }

  const result = db.delete(projects).where(eq(projects.id, id)).run();
  return result.changes > 0;
}

export function getDecryptedEnvVars(
  db: DbClient,
  projectId: string,
): Array<{ key: string; value: string }> {
  const rows = db.select().from(envVariables).where(eq(envVariables.projectId, projectId)).all();
  return rows.map((r) => ({
    key: r.key,
    value: decrypt(r.encryptedValue, encryptionKey()),
  }));
}

export function getProjectEnvVars(db: DbClient, projectId: string) {
  const rows = db.select().from(envVariables).where(eq(envVariables.projectId, projectId)).all();

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    key: r.key,
    value: r.isSecret ? '••••••••' : decrypt(r.encryptedValue, encryptionKey()),
    isSecret: r.isSecret,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export function setProjectEnvVars(db: DbClient, projectId: string, vars: UpdateEnvVarsInput) {
  const key = encryptionKey();

  db.transaction((tx) => {
    for (const v of vars) {
      tx.delete(envVariables)
        .where(and(eq(envVariables.projectId, projectId), eq(envVariables.key, v.key)))
        .run();

      tx.insert(envVariables)
        .values({
          projectId,
          key: v.key,
          encryptedValue: encrypt(v.value, key),
          isSecret: v.isSecret ?? true,
        })
        .run();
    }
  });
}
