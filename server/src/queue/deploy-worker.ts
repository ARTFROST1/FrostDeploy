import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { DbClient } from '@fd/db';
import type { DeployStep } from '@fd/shared';
import { DEPLOY_TIMEOUT_MS, HEALTH_CHECK_RETRIES, HEALTH_CHECK_INTERVAL_MS } from '@fd/shared';
import type { SSEEvent } from '../lib/sse.js';
import { cloneRepo, fetchOrigin, checkoutSha } from '../services/git-service.js';
import { installDeps, runBuild } from '../services/build-service.js';
import { syncFiles } from '../lib/rsync.js';
import { createUnit, startService, restartService } from '../lib/systemd.js';
import { getDecryptedSetting } from '../services/settings-service.js';
import {
  createDeployment,
  acquireLock,
  releaseLock,
  updateDeploymentStatus,
  updateProjectStatus,
  updateProjectSha,
} from '../services/deploy-service.js';
import { getDecryptedEnvVars } from '../services/project-service.js';

interface Project {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  port: number;
  buildCmd: string | null;
  outputDir: string | null;
  rootDir: string | null;
  srcDir: string;
  runtimeDir: string;
  currentSha: string | null;
  extraPath: string | null;
  runUser: string | null;
  limitNofile: number | null;
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

    // Compute effective build directory (rootDir support)
    const buildDir = project.rootDir ? path.join(project.srcDir, project.rootDir) : project.srcDir;
    // Security: prevent path traversal
    if (!buildDir.startsWith(project.srcDir)) {
      throw new Error('Invalid rootDir: path traversal detected');
    }

    // Retrieve PAT for git operations
    const pat = getDecryptedSetting(db, 'github_pat') ?? undefined;

    // Run pipeline steps, racing against global timeout
    await Promise.race([
      (async () => {
        // 4. Fetch / Clone
        await runStep('fetch', 'Fetching source', onEvent, async () => {
          if (existsSync(path.join(project.srcDir, '.git'))) {
            await fetchOrigin(project.srcDir, pat);
          } else {
            await cloneRepo(project.repoUrl, pat, project.srcDir);
          }
        });

        // 5. Checkout
        await runStep('checkout', 'Checking out commit', onEvent, async () => {
          await checkoutSha(project.srcDir, sha);
        });

        // 6. Install dependencies
        await runStep('install', 'Install dependencies', onEvent, async () => {
          await installDeps(buildDir, onLog);
        });

        // 7. Build project
        await runStep('build', 'Build project', onEvent, async () => {
          await runBuild(buildDir, project.buildCmd || 'npm run build', onLog);
        });

        // 7. Sync
        await runStep('sync', 'Syncing files', onEvent, async () => {
          await syncFiles(buildDir, project.runtimeDir, project.outputDir || 'dist', onLog);
        });

        // 7.5 Pre-restart port check
        if (process.platform !== 'darwin') {
          try {
            const ssOutput = execFileSync('ss', ['-tlnH'], { encoding: 'utf-8', timeout: 5000 });
            const portInUse = ssOutput
              .split('\n')
              .some((line) => new RegExp(`:${project.port}\\s`).test(line));
            if (portInUse) {
              let ownService = false;
              try {
                execFileSync('systemctl', ['is-active', `frostdeploy-${project.name}`], {
                  encoding: 'utf-8',
                  timeout: 5000,
                });
                ownService = true;
              } catch {
                ownService = false;
              }
              if (!ownService) {
                throw new Error(
                  `Port ${project.port} is occupied by a non-FrostDeploy process. ` +
                    `Free the port before deploying.`,
                );
              }
            }
          } catch (err) {
            if (err instanceof Error && err.message.startsWith('Port ')) throw err;
          }
        }

        // 7.6 Write env file
        const envVarsDir = '/var/lib/frostdeploy/env';
        const envVarsPath = `${envVarsDir}/${project.name}.env`;
        await runStep('env', 'Writing env file', onEvent, async () => {
          const vars = getDecryptedEnvVars(db, project.id);
          const IS_MAC = process.platform === 'darwin';
          const lines = vars.map(
            (v) => `${v.key}="${v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
          );
          const content = lines.length ? lines.join('\n') + '\n' : '# no env vars\n';
          if (IS_MAC) {
            onLog(`[mac] Would write ${vars.length} env var(s) to ${envVarsPath}`);
          } else {
            mkdirSync(envVarsDir, { recursive: true });
            writeFileSync(envVarsPath, content, { encoding: 'utf-8' });
            chmodSync(envVarsPath, 0o600);
            onLog(`Wrote ${vars.length} env var(s) to ${envVarsPath}`);
          }
        });

        // 8. Restart (always recreate unit with envFilePath)
        await runStep('restart', 'Restarting service', onEvent, async () => {
          const unitPath = `/etc/systemd/system/frostdeploy-${project.name}.service`;
          const wasRunning = existsSync(unitPath);
          onLog(`Creating/updating unit file at ${unitPath}`);
          await createUnit({
            name: project.name,
            runtimeDir: project.runtimeDir,
            startCmd: 'npm start',
            port: project.port,
            envFilePath: envVarsPath,
            cpuQuota: undefined,
            memoryMax: undefined,
            extraPath: project.extraPath ?? undefined,
            runUser: project.runUser ?? undefined,
            limitNofile: project.limitNofile ?? undefined,
          });
          if (wasRunning) {
            await restartService(project.name);
          } else {
            await startService(project.name);
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
