import { NavLink } from 'react-router';
import type { Project } from '@fd/shared';
import { cn } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/constants';

interface SidebarProjectItemProps {
  project: Project;
  isActive: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

export default function SidebarProjectItem({
  project,
  isActive,
  collapsed,
  onClick,
}: SidebarProjectItemProps) {
  const isDeploying = project.status === 'deploying';
  const dotColor = STATUS_COLORS[project.status as keyof typeof STATUS_COLORS] ?? 'bg-zinc-500';

  return (
    <NavLink
      to={`/projects/${project.id}`}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-sidebar-accent/50 font-medium text-sidebar-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground',
        collapsed && 'justify-center px-0',
      )}
      title={collapsed ? project.name : undefined}
    >
      {/* Status dot */}
      <span
        className={cn(
          'inline-block h-2 w-2 shrink-0 rounded-full',
          dotColor,
          isDeploying && 'animate-pulse',
        )}
        aria-label={`Статус: ${project.status}`}
      />

      {/* Project name */}
      {!collapsed && <span className="truncate">{project.name}</span>}
    </NavLink>
  );
}
