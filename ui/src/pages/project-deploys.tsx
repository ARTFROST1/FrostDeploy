import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Rocket, Timer, GitCommit } from 'lucide-react';

import { fetchDeployments } from '@/api/deploys';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRelativeTime, formatDuration, shortSha, truncate } from '@/lib/utils';

const PER_PAGE = 15;

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  webhook: 'Webhook',
  rollback: 'Rollback',
  cli: 'CLI',
};

function SkeletonRows() {
  return Array.from({ length: 6 }).map((_, i) => (
    <TableRow key={i}>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16" />
      </TableCell>
    </TableRow>
  ));
}

export default function ProjectDeploysPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['deployments', id, page],
    queryFn: () => fetchDeployments(id!, page, PER_PAGE),
    enabled: !!id,
  });

  const deploys = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !isLoading && deploys.length === 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 ring-1 ring-blue-500/25">
          <Rocket className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Deploys</h1>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.total} deployment{data.total !== 1 && 's'}
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="w-[140px]">Дата</TableHead>
              <TableHead className="w-[100px]">SHA</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead className="w-[120px]">Статус</TableHead>
              <TableHead className="w-[100px]">
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Время
                </span>
              </TableHead>
              <TableHead className="w-[100px]">Триггер</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && <SkeletonRows />}

            {isEmpty && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Rocket className="h-10 w-10 opacity-20" />
                    <div>
                      <p className="font-medium">Деплоев пока нет</p>
                      <p className="text-xs">Запустите первый деплой, чтобы он появился здесь</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {deploys.map((deploy) => (
              <TableRow
                key={deploy.id}
                className="cursor-pointer border-border/40 transition-colors hover:bg-muted/40"
                onClick={() => navigate(`/projects/${id}/deploys/${deploy.id}`)}
              >
                <TableCell className="text-muted-foreground text-xs">
                  {formatRelativeTime(deploy.startedAt ?? deploy.createdAt)}
                </TableCell>

                <TableCell>
                  <code className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    <GitCommit className="h-3 w-3 shrink-0 opacity-50" />
                    {shortSha(deploy.commitSha)}
                  </code>
                </TableCell>

                <TableCell className="max-w-[300px]">
                  <span className="text-sm text-foreground/90">
                    {deploy.commitMsg ? truncate(deploy.commitMsg, 50) : '—'}
                  </span>
                </TableCell>

                <TableCell>
                  <StatusBadge status={deploy.status} />
                </TableCell>

                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {deploy.durationMs != null ? formatDuration(deploy.durationMs) : '—'}
                </TableCell>

                <TableCell>
                  <Badge
                    variant={deploy.triggeredBy === 'rollback' ? 'secondary' : 'outline'}
                    className="text-xs font-normal"
                  >
                    {TRIGGER_LABELS[deploy.triggeredBy] ?? deploy.triggeredBy}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground tabular-nums">
            Стр. {page} из {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Вперёд
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
