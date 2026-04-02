import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, ExternalLink, ShieldCheck, Clock, GitBranch, Server } from 'lucide-react';
import { toast } from 'sonner';

import { fetchProject, fetchCommits } from '@/api/projects';
import { fetchDeployments, triggerDeploy } from '@/api/deploys';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { CommitCard } from '@/components/commit-card';
import { cn, formatRelativeTime, formatDuration, shortSha, truncate } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/constants';

export default function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  const { data: commits, isLoading: commitsLoading } = useQuery({
    queryKey: ['commits', id],
    queryFn: () => fetchCommits(id!),
    enabled: !!id,
  });

  const { data: deploymentsData, isLoading: deploysLoading } = useQuery({
    queryKey: ['deployments', id],
    queryFn: () => fetchDeployments(id!, 1, 1),
    enabled: !!id,
  });

  const lastDeploy = deploymentsData?.items?.[0] ?? null;

  const deployMutation = useMutation({
    mutationFn: (sha: string) => triggerDeploy(id!, sha),
    onSuccess: () => {
      toast.success('Деплой запущен');
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['deployments', id] });
      queryClient.invalidateQueries({ queryKey: ['commits', id] });
    },
    onError: () => {
      toast.error('Не удалось запустить деплой');
    },
  });

  // ── Skeleton state ──────────────────────────────────────────────
  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-5 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) return null;

  const statusKey = project.status as keyof typeof STATUS_COLORS;

  return (
    <div className="space-y-8">
      {/* ── Info cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Card 1 — Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Статус</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-block h-2.5 w-2.5 rounded-full',
                  STATUS_COLORS[statusKey] ?? 'bg-zinc-500',
                )}
              />
              <StatusBadge status={project.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {project.currentSha && (
                <span className="font-mono text-xs">{shortSha(project.currentSha)}</span>
              )}
              {project.framework && (
                <span className="flex items-center gap-1">
                  <Server className="h-3.5 w-3.5" />
                  {project.framework}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />:{project.port}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2 — Domain */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Домен</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.domain ? (
              <>
                <a
                  href={`https://${project.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:underline"
                >
                  {project.domain}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <div className="flex items-center gap-1 text-xs text-emerald-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  SSL ✅
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Нет домена</span>
            )}
          </CardContent>
        </Card>

        {/* Card 3 — Last Deploy */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Последний деплой
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deploysLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : lastDeploy ? (
              <div className="space-y-1.5">
                <StatusBadge status={lastDeploy.status} />
                <div className="text-sm text-muted-foreground">
                  {lastDeploy.startedAt ? formatRelativeTime(lastDeploy.startedAt) : '—'}
                  {lastDeploy.durationMs != null && (
                    <span className="ml-1">({formatDuration(lastDeploy.durationMs)})</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-mono">{shortSha(lastDeploy.commitSha)}</span>
                  {lastDeploy.commitMsg && (
                    <span className="truncate">{truncate(lastDeploy.commitMsg, 40)}</span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Деплоев пока нет</span>
            )}
          </CardContent>
        </Card>

        {/* Card 4 — Uptime */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {project.status === 'active' ? (
                <span className="text-foreground">{formatRelativeTime(project.updatedAt)}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  project.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-500',
                )}
              />
              {project.status === 'active' ? 'Running' : 'Inactive'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Commits ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
          <GitBranch className="h-4 w-4" />
          Последние коммиты
          <span className="text-sm font-normal text-muted-foreground">({project.branch})</span>
        </h2>

        {commitsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : commits && commits.length > 0 ? (
          <div className="space-y-2">
            {commits.slice(0, 15).map((commit) => (
              <CommitCard
                key={commit.sha}
                commit={commit}
                isCurrent={project.currentSha === commit.sha}
                isDeploying={deployMutation.isPending}
                onDeploy={(sha) => deployMutation.mutate(sha)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Коммитов не найдено</p>
        )}
      </section>
    </div>
  );
}
