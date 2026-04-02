import { CheckCircle2, CircleDashed, Loader2, MinusCircle, XCircle } from 'lucide-react';
import type { DeployStep, StepStatus } from '@fd/shared';
import { cn } from '@/lib/utils';

interface StepInfo {
  step: DeployStep;
  status: StepStatus;
  message?: string;
}

interface DeployProgressProps {
  steps: StepInfo[];
}

const STEP_LABELS: Record<DeployStep, string> = {
  fetch: 'Fetch',
  checkout: 'Checkout',
  install: 'Install',
  build: 'Build',
  sync: 'Sync',
  env: 'Env',
  restart: 'Restart',
  healthcheck: 'Health',
};

const statusIcon: Record<StepStatus, React.ReactNode> = {
  pending: <CircleDashed className="size-5 text-zinc-500" />,
  running: <Loader2 className="size-5 animate-spin text-blue-500" />,
  success: <CheckCircle2 className="size-5 text-emerald-500" />,
  failed: <XCircle className="size-5 text-red-500" />,
  skipped: <MinusCircle className="size-5 text-zinc-600" />,
};

const connectorColor: Record<StepStatus, string> = {
  pending: 'bg-zinc-700',
  running: 'bg-blue-500/50',
  success: 'bg-emerald-500/60',
  failed: 'bg-red-500/60',
  skipped: 'bg-zinc-700',
};

const ringColor: Record<StepStatus, string> = {
  pending: 'border-zinc-700',
  running: 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.35)]',
  success: 'border-emerald-500/60',
  failed: 'border-red-500/60',
  skipped: 'border-zinc-700',
};

export function DeployProgress({ steps }: DeployProgressProps) {
  return (
    <div className="flex items-start gap-0 overflow-x-auto py-4">
      {steps.map((s, i) => (
        <div key={s.step} className="flex items-start">
          {/* Step node */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-full border-2 bg-zinc-900 transition-all',
                ringColor[s.status],
                s.status === 'running' && 'animate-pulse',
              )}
            >
              {statusIcon[s.status]}
            </div>
            <span
              className={cn(
                'text-[11px] font-medium tracking-wide',
                s.status === 'running' && 'text-blue-400',
                s.status === 'success' && 'text-emerald-400',
                s.status === 'failed' && 'text-red-400',
                s.status === 'pending' && 'text-zinc-500',
                s.status === 'skipped' && 'text-zinc-600',
              )}
            >
              {STEP_LABELS[s.step]}
            </span>
            {s.message && (
              <span className="max-w-[72px] truncate text-center text-[10px] text-zinc-500">
                {s.message}
              </span>
            )}
          </div>

          {/* Connector */}
          {i < steps.length - 1 && (
            <div className="mt-[18px] flex items-center px-1">
              <div
                className={cn(
                  'h-[2px] w-8 rounded-full transition-colors md:w-12',
                  connectorColor[
                    s.status === 'success'
                      ? 'success'
                      : steps[i + 1]?.status === 'running'
                        ? 'running'
                        : 'pending'
                  ],
                )}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
