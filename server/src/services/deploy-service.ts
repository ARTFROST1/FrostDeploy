import { eq, sql, and, lt, count } from 'drizzle-orm';
import { projects, deployments, deployLocks } from '@fd/db';
import type { DbClient } from '@fd/db';
import type { DeployStatus, Deployment, TriggeredBy } from '@fd/shared';

export function createDeployment(
  db: DbClient,
  projectId: string,
  sha: string,
  commitMsg: string | null,
  triggeredBy: TriggeredBy,
): string {
  const row = db
    .insert(deployments)
    .values({
      projectId,
      commitSha: sha,
      commitMsg,
      status: 'queued',
      triggeredBy,
    })
    .returning({ id: deployments.id })
    .get();

  return row.id;
}

export function acquireLock(db: DbClient, projectId: string, deploymentId: string): boolean {
  try {
    db.insert(deployLocks).values({ projectId, deploymentId }).run();
    return true;
  } catch (err: unknown) {
    // UNIQUE constraint violation means project is already locked
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return false;
    }
    throw err;
  }
}

export function releaseLock(db: DbClient, projectId: string): void {
  db.delete(deployLocks).where(eq(deployLocks.projectId, projectId)).run();
}

export function updateDeploymentStatus(
  db: DbClient,
  deploymentId: string,
  status: DeployStatus,
  extra?: {
    error?: string;
    logs?: string;
    durationMs?: number;
    startedAt?: string;
    finishedAt?: string;
  },
): void {
  db.update(deployments)
    .set({
      status,
      ...extra,
    })
    .where(eq(deployments.id, deploymentId))
    .run();
}

export function updateProjectStatus(
  db: DbClient,
  projectId: string,
  status: 'created' | 'active' | 'deploying' | 'error' | 'stopped',
): void {
  db.update(projects)
    .set({ status, updatedAt: sql`(datetime('now'))` })
    .where(eq(projects.id, projectId))
    .run();
}

export function updateProjectSha(db: DbClient, projectId: string, sha: string): void {
  db.update(projects)
    .set({ currentSha: sha, updatedAt: sql`(datetime('now'))` })
    .where(eq(projects.id, projectId))
    .run();
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

export function getDeploymentsByProject(
  db: DbClient,
  projectId: string,
  page: number = 1,
  perPage: number = 20,
): PaginatedResult<Omit<Deployment, 'logs'>> {
  const offset = (page - 1) * perPage;

  const totalRow = db
    .select({ total: count() })
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .get();

  const rows = db
    .select({
      id: deployments.id,
      projectId: deployments.projectId,
      commitSha: deployments.commitSha,
      commitMsg: deployments.commitMsg,
      status: deployments.status,
      durationMs: deployments.durationMs,
      error: deployments.error,
      triggeredBy: deployments.triggeredBy,
      startedAt: deployments.startedAt,
      finishedAt: deployments.finishedAt,
      createdAt: deployments.createdAt,
    })
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .orderBy(sql`${deployments.createdAt} DESC`)
    .limit(perPage)
    .offset(offset)
    .all();

  return {
    data: rows,
    total: totalRow!.total,
    page,
    perPage,
  };
}

export function getDeploymentById(
  db: DbClient,
  projectId: string,
  deploymentId: string,
): Deployment | null {
  const row = db
    .select()
    .from(deployments)
    .where(and(eq(deployments.id, deploymentId), eq(deployments.projectId, projectId)))
    .get();

  return (row as Deployment | undefined) ?? null;
}

export function cleanupOrphanedLocks(db: DbClient): void {
  db.delete(deployLocks)
    .where(lt(deployLocks.lockedAt, sql`datetime('now', '-10 minutes')`))
    .run();
}
