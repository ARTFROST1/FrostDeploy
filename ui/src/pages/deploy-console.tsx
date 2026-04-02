import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  GitCommitHorizontal,
  Clock,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { DeployStep, StepStatus, DeployStepInfo } from '@fd/shared';
import { DEPLOY_STEPS } from '@fd/shared';
import { fetchDeployment } from '@/api/deploys';
import { useSSE, type SSEEvent } from '@/hooks/use-sse';
import { DeployProgress } from '@/components/deploy-progress';
import { DeployLog, type LogLine } from '@/components/deploy-log';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatRelativeTime, shortSha } from '@/lib/utils';

/* ---------- helpers ---------- */

function buildSteps(events: SSEEvent[]): DeployStepInfo[] {
  const map = new Map<DeployStep, DeployStepInfo>();
  for (const s of DEPLOY_STEPS) {
    map.set(s, { step: s, status: 'pending' });
  }
  for (const e of events) {
    if (e.type === 'step') {
      const step = e.step as DeployStep;
      const info = map.get(step);
      if (info) {
        info.status = e.status as StepStatus;
        info.message = (e.message as string) ?? undefined;
      }
    }
  }
  return Array.from(map.values());
}

function buildLogs(events: SSEEvent[]): LogLine[] {
  const lines: LogLine[] = [];
  for (const e of events) {
    if (e.type === 'log') {
      lines.push({
        message: e.message as string,
        timestamp: e.timestamp as string,
        type: 'log',
      });
    } else if (e.type === 'error') {
      lines.push({
        message: (e.error as string) ?? (e.message as string) ?? 'Unknown error',
        timestamp: e.timestamp as string,
        type: 'error',
      });
    } else if (e.type === 'status') {
      lines.push({
        message: e.message as string,
        timestamp: e.timestamp as string,
        type: 'info',
      });
    } else if (e.type === 'complete') {
      lines.push({
        message: (e.message as string) ?? 'Deploy complete',
        timestamp: e.timestamp as string,
        type: 'info',
      });
    }
  }
  return lines;
}

function historicalSteps(status: string): DeployStepInfo[] {
  return DEPLOY_STEPS.map((step) => ({
    step,
    status: (status === 'success' ? 'success' : 'failed') as StepStatus,
  }));
}

function parseHistoricalLogs(raw: string | null): LogLine[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[(.+?)\]\s*(.*)/);
      return {
        timestamp: match?.[1] ?? new Date().toISOString(),
        message: match?.[2] ?? line,
        type: 'log' as const,
      };
    });
}

/* ---------- component ---------- */

export default function DeployConsolePage() {
  const { id: projectId, deployId } = useParams<{ id: string; deployId: string }>();
  const isLive = deployId === 'current';

  /* --- SSE (live mode) --- */
  const sseUrl = isLive && projectId ? `/api/projects/${projectId}/deploy/stream` : null;
  const { events, status: sseStatus, isComplete, error: sseError } = useSSE(sseUrl);

  const liveSteps = useMemo(() => buildSteps(events), [events]);
  const liveLogs = useMemo(() => buildLogs(events), [events]);

  /* --- Query (historical mode) --- */
  const { data: deployment, isLoading } = useQuery({
    queryKey: ['deployment', projectId, deployId],
    queryFn: () => fetchDeployment(projectId!, deployId!),
    enabled: !isLive && !!projectId && !!deployId,
  });

  /* --- Derived data --- */
  const steps = isLive ? liveSteps : deployment ? historicalSteps(deployment.status) : [];
  const logs = isLive ? liveLogs : deployment ? parseHistoricalLogs(deployment.logs) : [];
  const isStreaming = isLive && !isComplete;

  /* --- Status summary from events --- */
  const lastStatusEvent = [...events]
    .reverse()
    .find((e) => e.type === 'status' || e.type === 'complete' || e.type === 'error');
  const liveStatus =
    lastStatusEvent?.type === 'complete'
      ? 'success'
      : lastStatusEvent?.type === 'error'
        ? 'failed'
        : ((lastStatusEvent?.status as string) ?? 'building');

  const displayStatus = isLive ? liveStatus : (deployment?.status ?? 'queued');
  const displaySha = deployment?.commitSha;
  const displayCommitMsg = deployment?.commitMsg;
  const displayDuration = deployment?.durationMs;
  const displayTriggeredBy = deployment?.triggeredBy;

  /* --- Loading state --- */
  if (!isLive && isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      {/* --- Header --- */}
      <div className="flex flex-col gap-3">
        <Link
          to={`/projects/${projectId}`}
          className="flex w-fit items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="size-3.5" />
          Назад к проекту
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="size-5 text-zinc-400" />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              {isLive ? 'Live Deploy' : `Deploy ${deployId?.slice(0, 8)}`}
            </h1>
          </div>

          <StatusBadge status={displayStatus} />

          {displaySha && (
            <Badge
              variant="outline"
              className="gap-1 border-zinc-700 font-mono text-xs text-zinc-400"
            >
              <GitCommitHorizontal className="size-3" />
              {shortSha(displaySha)}
            </Badge>
          )}

          {displayTriggeredBy && (
            <Badge variant="outline" className="border-zinc-700 text-xs text-zinc-500">
              {displayTriggeredBy}
            </Badge>
          )}

          {displayDuration != null && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock className="size-3" />
              {formatDuration(displayDuration)}
            </span>
          )}

          {deployment?.startedAt && (
            <span className="text-xs text-zinc-600">
              {formatRelativeTime(deployment.startedAt)}
            </span>
          )}
        </div>

        {displayCommitMsg && (
          <p className="max-w-xl truncate text-sm text-zinc-400">{displayCommitMsg}</p>
        )}
      </div>

      {/* --- SSE connection indicator (live) --- */}
      {isLive && (
        <div className="flex items-center gap-2 text-xs">
          {sseStatus === 'connecting' && (
            <>
              <Loader2 className="size-3 animate-spin text-blue-400" />
              <span className="text-zinc-500">Подключение к потоку…</span>
            </>
          )}
          {sseStatus === 'connected' && !isComplete && (
            <>
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-zinc-500">Подключено — получение событий</span>
            </>
          )}
          {sseStatus === 'error' && (
            <>
              <XCircle className="size-3 text-red-400" />
              <span className="text-red-400">Соединение потеряно</span>
            </>
          )}
        </div>
      )}

      {/* --- Completion banner --- */}
      {isComplete && !sseError && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-sm text-emerald-400">
          <CheckCircle2 className="size-4" />
          Деплой завершён успешно
        </div>
      )}
      {sseError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400">
          <XCircle className="size-4" />
          {sseError}
        </div>
      )}

      {/* --- Historical error banner --- */}
      {!isLive && deployment?.status === 'failed' && deployment.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400">
          <XCircle className="size-4" />
          {deployment.error}
        </div>
      )}

      {/* --- Pipeline progress --- */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4">
        <DeployProgress steps={steps} />
      </div>

      {/* --- Log viewer (flexes to fill remaining space) --- */}
      <DeployLog lines={logs} isStreaming={isStreaming} />
    </div>
  );
}
