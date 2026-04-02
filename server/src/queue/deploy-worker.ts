import { existsSync } from 'node:fs';
import path from 'node:path';
import type { DbClient } from '@fd/db';
import type { DeployStep } from '@fd/shared';
import { DEPLOY_TIMEOUT_MS, HEALTH_CHECK_RETRIES, HEALTH_CHECK_INTERVAL_MS } from '@fd/shared';
import type { SSEEvent } from '../lib/sse.js';
import { cloneRepo, fetchOrigin, checkoutSha } from '../services/git-service.js';
import { installDeps, runBuild } from '../services/build-service.js';
import { syncFiles } from '../lib/rsync.js';
import { createUnit, startService, restartService } from '../lib/systemd.js';
import {
  createDeployment,
  acquireLock,
  releaseLock,
  updateDeploymentStatus,
  updateProjectStatus,
  updateProjectSha,
} from '../services/deploy-service.js';

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

type OnEvent = (event: SSEEvent) => Promise<void>;

function now(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function healthCheck(
  port: number,
  retries: number = HEALTH_CHECK_RETRIES,
  interval: number = HEALTH_CHECK_INTERVAL_MS,
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) return true;
    } catch {
      /* ignore */
    }
    if (i < retries - 1) await sleep(interval);
  }
  return false;
}

async function runStep(
  step: DeployStep,
  label: string,
  onEvent: OnEvent,
  fn: () => Promise<void>,
): Promise<void> {
  const start = Date.now();
  await onEvent({
    type: 'step',
    step,
    status: 'running',
    message: `${label}...`,
    timestamp: now(),
  });

  await fn();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  await onEvent({
    type: 'step',
    step,
    status: 'success',
    message: `${label} done in ${elapsed}s`,
    timestamp: now(),
  });
}

export async function executePipeline(
  db: DbClient,
  project: Project,
  sha: string,
  commitMsg: string | null,
  triggeredBy: 'manual' | 'webhook' | 'rollback' | 'cli',
  onEvent: OnEvent,
  force: boolean = false,
): Promise<void> {
  // Build skip optimization (FR-304)
  if (project.currentSha === sha && !force) {
    await onEvent({
      type: 'complete',
      message: 'Already deployed — skipping build',
      timestamp: now(),
    });
    return;
  }

  const pipelineStart = Date.now();
  let deploymentId: string | undefined;
  const logLines: string[] = [];

  const onLog = (line: string) => {
    logLines.push(line);
    onEvent({ type: 'log', message: line, timestamp: now() }).catch(() => {});
  };

  // Global timeout via AbortController
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DEPLOY_TIMEOUT_MS);

  const abortPromise = new Promise<never>((_, reject) => {
    ac.signal.addEventListener('abort', () =>
      reject(new Error(`Deploy timed out after ${DEPLOY_TIMEOUT_MS / 1000}s`)),
    );
  });

  try {
    // 1. Create deployment record
    deploymentId = createDeployment(db, project.id, sha, commitMsg, triggeredBy);

    // 2. Acquire lock with real deploymentId
    const locked = acquireLock(db, project.id, deploymentId);
    if (!locked) {
      throw new Error('Deploy in progress');
    }

    // 3. Update statuses
    const startedAt = now();
    updateDeploymentStatus(db, deploymentId, 'building', { startedAt });
    updateProjectStatus(db, project.id, 'deploying');

    await onEvent({
      type: 'status',
      status: 'building',
      message: 'Deploy started',
      timestamp: now(),
    });

    // Run pipeline steps, racing against global timeout
    await Promise.race([
      (async () => {
        // 4. Fetch / Clone
        await runStep('fetch', 'Fetching source', onEvent, async () => {
          if (existsSync(path.join(project.srcDir, '.git'))) {
            await fetchOrigin(project.srcDir);
          } else {
            await cloneRepo(project.repoUrl, undefined, project.srcDir);
          }
        });

        // 5. Checkout
        await runStep('checkout', 'Checking out commit', onEvent, async () => {
          await checkoutSha(project.srcDir, sha);
        });

        // 6. Install dependencies
        await runStep('install', 'Install dependencies', onEvent, async () => {
          await installDeps(project.srcDir, onLog);
        });

        // 7. Build project
        await runStep('build', 'Build project', onEvent, async () => {
          await runBuild(project.srcDir, project.buildCmd || 'npm run build', onLog);
        });

        // 7. Sync
        await runStep('sync', 'Syncing files', onEvent, async () => {
          await syncFiles(project.srcDir, project.runtimeDir, project.outputDir || 'dist', onLog);
        });

        // 8. Restart (create unit if missing)
        await runStep('restart', 'Restarting service', onEvent, async () => {
          const unitPath = `/etc/systemd/system/frostdeploy-${project.name}.service`;
          if (!existsSync(unitPath)) {
            onLog(`Unit file not found at ${unitPath}, creating...`);
            await createUnit({
              name: project.name,
              runtimeDir: project.runtimeDir,
              startCmd: 'npm start',
              port: project.port,
              envFilePath: undefined,
              cpuQuota: undefined,
              memoryMax: undefined,
            });
            await startService(project.name);
          } else {
            await restartService(project.name);
          }
        });

        // 9. Health check
        await runStep('healthcheck', 'Health check', onEvent, async () => {
          const healthy = await healthCheck(project.port);
          if (!healthy) {
            throw new Error(
              `Health check failed: no HTTP 200 from port ${project.port} after ${HEALTH_CHECK_RETRIES} retries`,
            );
          }
        });
      })(),
      abortPromise,
    ]);

    // 10. Finalize — success
    const durationMs = Date.now() - pipelineStart;
    const finishedAt = now();

    updateDeploymentStatus(db, deploymentId, 'success', {
      logs: logLines.join('\n'),
      durationMs,
      finishedAt,
    });
    updateProjectSha(db, project.id, sha);
    updateProjectStatus(db, project.id, 'active');

    await onEvent({
      type: 'complete',
      message: `Deploy successful in ${(durationMs / 1000).toFixed(1)}s`,
      timestamp: now(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (deploymentId) {
      const durationMs = Date.now() - pipelineStart;
      updateDeploymentStatus(db, deploymentId, 'failed', {
        error: message,
        logs: logLines.join('\n'),
        durationMs,
        finishedAt: now(),
      });
    }

    updateProjectStatus(db, project.id, 'error');

    await onEvent({ type: 'error', error: message, timestamp: now() });

    throw err;
  } finally {
    clearTimeout(timer);
    releaseLock(db, project.id);
  }
}
