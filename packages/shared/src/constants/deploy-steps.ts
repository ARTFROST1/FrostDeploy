import type { DeployStep } from '../types/deployment.js';

export const DEPLOY_STEPS: readonly DeployStep[] = [
  'fetch',
  'checkout',
  'install',
  'build',
  'sync',
  'restart',
  'healthcheck',
] as const;

export const DEPLOY_TIMEOUT_MS = 600_000; // 10 minutes
export const HEALTH_CHECK_RETRIES = 5;
export const HEALTH_CHECK_INTERVAL_MS = 2_000;
