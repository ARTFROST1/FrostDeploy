import { Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { Cpu, MemoryStick, HardDrive, FolderGit2, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { Project, Deployment } from '@fd/shared';
import { fetchProjects } from '@/api/projects';
import { triggerDeploy, fetchDeployments } from '@/api/deploys';
import { useSystemMetrics } from '@/hooks/use-system-metrics';
import { MetricCard } from '@/components/metric-card';
import { ProjectCard } from '@/components/project-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { POLLING_INTERVALS } from '@/lib/constants';
import { formatRelativeTime, formatDuration, shortSha } from '@/lib/utils';

function formatGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

/* ─── Skeleton states ──────────────────────────────────────────────── */

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[100px] rounded-xl" />
      ))}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] rounded-xl" />
      ))}
    </div>
  );
}

function DeploysSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 rounded-md" />
      ))}
    </div>
  );
}

/* ─── Recent Deploys Table ─────────────────────────────────────────── */

interface RecentDeploy extends Deployment {
  projectName: string;
  projectId: string;
}

function RecentDeploysTable({ deploys }: { deploys: RecentDeploy[] }) {
  const navigate = useNavigate();

  if (deploys.length === 0) {
    return <p className="text-sm text-muted-foreground">Нет деплоев</p>;
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Проект</th>
            <th className="px-4 py-2 font-medium">Коммит</th>
            <th className="px-4 py-2 font-medium">Статус</th>
            <th className="hidden px-4 py-2 font-medium sm:table-cell">Время</th>
            <th className="hidden px-4 py-2 font-medium sm:table-cell">Длительность</th>
          </tr>
        </thead>
        <tbody>
          {deploys.map((d) => (
            <tr
              key={d.id}
              className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/projects/${d.projectId}/deploys/${d.id}`)}
            >
              <td className="px-4 py-2 font-medium">{d.projectName}</td>
              <td className="px-4 py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {shortSha(d.commitSha)}
                </code>
              </td>
              <td className="px-4 py-2">
                <StatusBadge status={d.status} />
              </td>
              <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">
                {d.createdAt ? formatRelativeTime(d.createdAt) : '—'}
              </td>
              <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">
                {d.durationMs ? formatDuration(d.durationMs) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ─── Dashboard Page ───────────────────────────────────────────────── */

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { metrics, isLoading: metricsLoading } = useSystemMetrics();

  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    refetchInterval: POLLING_INTERVALS.projects,
  });

  // Fetch recent deploys per project (top 5 each), then merge
  const deployQueries = useQueries({
    queries: (projects ?? []).map((p: Project) => ({
      queryKey: ['deployments', p.id, 1, 5],
      queryFn: () => fetchDeployments(p.id, 1, 5),
      enabled: !!projects,
    })),
  });

  const recentDeploys: RecentDeploy[] = (projects ?? [])
    .flatMap((p: Project, idx: number) => {
      const data = deployQueries[idx]?.data;
      if (!data) return [];
      return data.items.map((d) => ({ ...d, projectName: p.name, projectId: p.id }));
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const deploysLoading = projectsLoading || deployQueries.some((q) => q.isLoading);

  const deployMutation = useMutation({
    mutationFn: (projectId: string) => triggerDeploy(projectId),
    onSuccess: (_data, projectId) => {
      toast.success('Деплой запущен');
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['deployments', projectId] });
    },
    onError: () => {
      toast.error('Не удалось запустить деплой');
    },
  });

  const activeCount = projects?.filter((p: Project) => p.status !== 'stopped').length ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="h-4 w-4" />
            Новый проект
          </Link>
        </Button>
      </div>

      {/* Metrics */}
      {metricsLoading || !metrics ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={FolderGit2} label="Проекты" value={String(activeCount)} />
          <MetricCard
            icon={Cpu}
            label="CPU"
            value={`${metrics.cpu.usage.toFixed(1)}%`}
            percentage={metrics.cpu.usage}
          />
          <MetricCard
            icon={MemoryStick}
            label="RAM"
            value={`${formatGB(metrics.memory.used)} / ${formatGB(metrics.memory.total)} GB`}
            percentage={metrics.memory.percentage}
          />
          <MetricCard
            icon={HardDrive}
            label="Диск"
            value={`${formatGB(metrics.disk.used)} / ${formatGB(metrics.disk.total)} GB`}
            percentage={metrics.disk.percentage}
          />
        </div>
      )}

      {/* Projects */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Проекты</h2>
        {projectsError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ошибка загрузки</AlertTitle>
            <AlertDescription>{projectsError.message}</AlertDescription>
          </Alert>
        ) : projectsLoading ? (
          <ProjectsSkeleton />
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p: Project) => (
              <ProjectCard key={p.id} project={p} onDeploy={(id) => deployMutation.mutate(id)} />
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <FolderGit2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium text-foreground">Нет проектов</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Создайте первый проект, чтобы начать деплой
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link to="/projects/new">
                <Plus className="h-4 w-4" />
                Новый проект
              </Link>
            </Button>
          </Card>
        )}
      </section>

      {/* Recent Deploys */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Последние деплои</h2>
        {deploysLoading ? <DeploysSkeleton /> : <RecentDeploysTable deploys={recentDeploys} />}
      </section>
    </div>
  );
}
