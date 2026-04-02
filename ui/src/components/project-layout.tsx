import { Outlet, NavLink, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchProject } from '@/api/projects';
import { triggerDeploy } from '@/api/deploys';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const TABS = [
  { label: 'Обзор', path: '' },
  { label: 'Деплои', path: '/deploys' },
  { label: 'Env', path: '/env' },
  { label: 'Логи', path: '/logs' },
  { label: 'Домен', path: '/domain' },
  { label: 'Настройки', path: '/settings' },
] as const;

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  const handleDeploy = () => {
    if (id) triggerDeploy(id);
  };

  return (
    <div>
      {/* Header: project name + deploy button */}
      <div className="flex items-center justify-between">
        {isLoading ? (
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        ) : (
          <h1 className="text-xl font-semibold text-foreground">{project?.name ?? 'Проект'}</h1>
        )}

        <Button size="sm" onClick={handleDeploy} disabled={isLoading} className="gap-1.5">
          <Rocket className="h-3.5 w-3.5" />
          Deploy latest
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="mt-4 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/projects/${id}${tab.path}`}
            end={tab.path === ''}
            className={({ isActive }) =>
              cn(
                'shrink-0 border-b-2 px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'border-ring font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Separator />

      {/* Tab content */}
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
