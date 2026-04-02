import { NavLink, useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Snowflake,
  LayoutDashboard,
  Plus,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchProjects } from '@/api/projects';
import { POLLING_INTERVALS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip } from '@/components/ui/tooltip';
import SidebarProjectItem from './sidebar-project-item';
import type { SidebarMode } from '@/hooks/use-sidebar';

interface SidebarProps {
  mode: SidebarMode;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export default function Sidebar({
  mode,
  isCollapsed,
  isOpen: _isOpen,
  onToggle,
  onClose,
}: SidebarProps) {
  const location = useLocation();
  const params = useParams();
  const activeProjectId = params.id;
  const collapsed = isCollapsed;

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    refetchInterval: POLLING_INTERVALS.projects,
  });

  const isDashboardActive = location.pathname === '/';
  const isSettingsActive = location.pathname === '/settings';

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar-background transition-all duration-200 ease-in-out',
        mode === 'mobile' ? 'w-60' : collapsed ? 'w-14' : 'w-60',
      )}
    >
      {/* Logo + Collapse / Close */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border px-3',
          collapsed && mode !== 'mobile' ? 'justify-center' : 'justify-between',
        )}
      >
        {(!collapsed || mode === 'mobile') && (
          <NavLink
            to="/"
            className="flex items-center gap-2 font-semibold text-sidebar-foreground"
            onClick={mode === 'mobile' ? onClose : undefined}
          >
            <Snowflake className="h-5 w-5 text-blue-400" />
            <span className="text-sm">FrostDeploy</span>
          </NavLink>
        )}

        {mode === 'mobile' ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground"
            aria-label="Закрыть меню"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground"
            aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Dashboard link */}
      <div className="px-2 pt-2">
        {collapsed && mode !== 'mobile' ? (
          <Tooltip content="Dashboard">
            <NavLink
              to="/"
              className={cn(
                'flex items-center justify-center rounded-md p-2 transition-colors',
                isDashboardActive
                  ? 'bg-sidebar-accent/50 text-sidebar-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground',
              )}
              aria-label="Dashboard"
            >
              <LayoutDashboard className="h-[18px] w-[18px]" />
            </NavLink>
          </Tooltip>
        ) : (
          <NavLink
            to="/"
            onClick={mode === 'mobile' ? onClose : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
              isDashboardActive
                ? 'bg-sidebar-accent/50 font-medium text-sidebar-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground',
            )}
          >
            <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
            <span>Dashboard</span>
          </NavLink>
        )}
      </div>

      <Separator className="mx-2 my-2 w-auto" />

      {/* Projects section */}
      <div className="flex min-h-0 flex-1 flex-col">
        {!collapsed && (
          <div className="px-3 pb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Проекты
            </span>
          </div>
        )}

        <ScrollArea className="flex-1 px-2">
          <div className="flex flex-col gap-0.5">
            {isLoading ? (
              <ProjectsSkeleton collapsed={collapsed} />
            ) : projects && projects.length > 0 ? (
              projects.map((project) =>
                collapsed ? (
                  <Tooltip key={project.id} content={project.name}>
                    <div>
                      <SidebarProjectItem
                        project={project}
                        isActive={activeProjectId === project.id}
                        collapsed
                      />
                    </div>
                  </Tooltip>
                ) : (
                  <SidebarProjectItem
                    key={project.id}
                    project={project}
                    isActive={activeProjectId === project.id}
                    onClick={mode === 'mobile' ? onClose : undefined}
                  />
                ),
              )
            ) : (
              !collapsed && (
                <p className="px-2.5 py-1.5 text-xs text-muted-foreground">Нет проектов</p>
              )
            )}
          </div>
        </ScrollArea>

        <Separator className="mx-2 my-2 w-auto" />

        {/* New project button */}
        <div className="px-2 pb-1">
          {collapsed && mode !== 'mobile' ? (
            <Tooltip content="Новый проект">
              <NavLink
                to="/projects/new"
                className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                aria-label="Новый проект"
              >
                <Plus className="h-[18px] w-[18px]" />
              </NavLink>
            </Tooltip>
          ) : (
            <NavLink
              to="/projects/new"
              onClick={mode === 'mobile' ? onClose : undefined}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
            >
              <Plus className="h-[18px] w-[18px] shrink-0" />
              <span>Новый проект</span>
            </NavLink>
          )}
        </div>
      </div>

      {/* Settings — pinned to bottom */}
      <Separator className="mx-2 w-auto" />
      <div className="px-2 py-2">
        {collapsed && mode !== 'mobile' ? (
          <Tooltip content="Настройки">
            <NavLink
              to="/settings"
              className={cn(
                'flex items-center justify-center rounded-md p-2 transition-colors',
                isSettingsActive
                  ? 'bg-sidebar-accent/50 text-sidebar-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground',
              )}
              aria-label="Настройки"
            >
              <Settings className="h-[18px] w-[18px]" />
            </NavLink>
          </Tooltip>
        ) : (
          <NavLink
            to="/settings"
            onClick={mode === 'mobile' ? onClose : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
              isSettingsActive
                ? 'bg-sidebar-accent/50 font-medium text-sidebar-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground',
            )}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span>Настройки</span>
          </NavLink>
        )}
      </div>
    </aside>
  );
}

function ProjectsSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2.5 py-1.5',
            collapsed && 'justify-center px-0',
          )}
        >
          <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-muted" />
          {!collapsed && (
            <div
              className="h-3.5 animate-pulse rounded bg-muted"
              style={{ width: `${60 + i * 20}px` }}
            />
          )}
        </div>
      ))}
    </>
  );
}
