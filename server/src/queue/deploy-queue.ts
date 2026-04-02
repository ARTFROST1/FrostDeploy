import type { DbClient } from '@fd/db';
import type { TriggeredBy } from '@fd/shared';
import type { SSEEvent } from '../lib/sse.js';
import { executePipeline } from './deploy-worker.js';
import { acquireLock, releaseLock, cleanupOrphanedLocks } from '../services/deploy-service.js';

interface Project {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  port: number;
  buildCmd: string | null;
  outputDir: string | null;
  srcDir: string;
  runtimeDir: string;
  currentSha: string | null;
}

export interface DeployJob {
  projectId: string;
  deploymentId?: string;
  startedAt: Date;
}

const activeDeploys = new Map<string, DeployJob>();

export class DeployConflictError extends Error {
  public readonly deployId: string | undefined;
  public readonly startedAt: Date;

  constructor(job: DeployJob) {
    super('Deploy in progress');
    this.name = 'DeployConflictError';
    this.deployId = job.deploymentId;
    this.startedAt = job.startedAt;
  }
}

export function enqueue(
  db: DbClient,
  project: Project,
  sha: string,
  commitMsg: string | null,
  triggeredBy: TriggeredBy,
  onEvent: (event: SSEEvent) => Promise<void>,
  force: boolean = false,
): void {
  const { id: projectId } = project;

  // Check in-memory map first
  const existing = activeDeploys.get(projectId);
  if (existing) {
    throw new DeployConflictError(existing);
  }

  // Check DB lock (handles server-restart edge case)
  const lockAcquired = acquireLock(db, projectId, '');
  if (!lockAcquired) {
    throw new DeployConflictError({
      projectId,
      startedAt: new Date(),
    });
  }
  // Release the probe lock — executePipeline acquires its own
  releaseLock(db, projectId);

  const job: DeployJob = {
    projectId,
    startedAt: new Date(),
  };
  activeDeploys.set(projectId, job);

  // Fire and forget — pipeline runs asynchronously
  executePipeline(db, project, sha, commitMsg, triggeredBy, onEvent, force)
    .catch(() => {
      // errors are handled inside executePipeline (status updates, SSE events)
    })
    .finally(() => {
      complete(projectId);
    });
}

export function complete(projectId: string): void {
  activeDeploys.delete(projectId);
}

export function isDeploying(projectId: string): DeployJob | null {
  return activeDeploys.get(projectId) ?? null;
}

export function startup(db: DbClient): void {
  cleanupOrphanedLocks(db);
}
