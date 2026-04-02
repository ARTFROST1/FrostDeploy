import { eq, desc, sql, and } from 'drizzle-orm';
import { projects, deployments, envVariables, domains } from '@fd/db';
import type { DbClient } from '@fd/db';
import type { CreateProjectInput, UpdateProjectInput, UpdateEnvVarsInput } from '@fd/shared';
import { PORT_RANGE_START, PORT_RANGE_END } from '@fd/shared';
import { encrypt, decrypt } from '../lib/crypto.js';

const encryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is not set');
  return key;
};

export function allocatePort(db: DbClient): number {
  const usedPorts = db
    .select({ port: projects.port })
    .from(projects)
    .orderBy(projects.port)
    .all()
    .map((r) => r.port);

  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
    if (!usedPorts.includes(p)) return p;
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

  return created!;
}

export function updateProject(db: DbClient, id: string, data: UpdateProjectInput) {
  const existing = db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get();
  if (!existing) return null;

  const updated = db
    .update(projects)
    .set({
      ...data,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(projects.id, id))
    .returning()
    .get();

  return updated!;
}

export function deleteProject(db: DbClient, id: string): boolean {
  const result = db.delete(projects).where(eq(projects.id, id)).run();
  return result.changes > 0;
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
