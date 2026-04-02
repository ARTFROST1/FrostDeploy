export type DeployStatus = 'queued' | 'building' | 'deploying' | 'success' | 'failed' | 'cancelled';

export type TriggeredBy = 'manual' | 'webhook' | 'rollback' | 'cli';

export type DeployStep =
  | 'fetch'
  | 'checkout'
  | 'install'
  | 'build'
  | 'sync'
  | 'env'
  | 'restart'
  | 'healthcheck';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface DeployStepInfo {
  step: DeployStep;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  commitSha: string;
  commitMsg: string | null;
  status: DeployStatus;
  logs: string | null;
  durationMs: number | null;
  error: string | null;
  triggeredBy: TriggeredBy;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
