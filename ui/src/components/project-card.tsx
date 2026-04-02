import { Link } from 'react-router';
import type { Project } from '@fd/shared';
import {
  Globe,
  Rocket,
  Disc,
  Zap,
  Atom,
  Server,
  Bolt,
  Flame,
  Box,
  FileText,
  HelpCircle,
  Play,
  ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { FRAMEWORK_ICONS } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import { useDeployStatus } from '@/hooks/use-deploy-status';

const ICON_MAP: Record<string, LucideIcon> = {
  Globe,
  Rocket,
  Disc,
  Zap,
  Atom,
  Server,
  Bolt,
  Flame,
  Box,
  FileText,
  HelpCircle,
};

function getFrameworkIcon(framework: string | null): LucideIcon {
  const iconName = FRAMEWORK_ICONS[framework ?? 'unknown'] ?? 'HelpCircle';
  return ICON_MAP[iconName] ?? HelpCircle;
}

interface ProjectCardProps {
  project: Project;
  onDeploy: (id: string) => void;
}

export function ProjectCard({ project, onDeploy }: ProjectCardProps) {
  const FrameworkIcon = getFrameworkIcon(project.framework);
  const { status, isDeploying } = useDeployStatus(project.id);

  return (
    <Link to={`/projects/${project.id}`} className="block">
      <Card className="flex items-center gap-4 p-4 transition-colors hover:border-accent/40">
        <FrameworkIcon className="h-8 w-8 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{project.name}</p>
          {project.domain ? (
            <a
              href={`https://${project.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {project.domain}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">нет домена</span>
          )}
        </div>

        <StatusBadge status={status} />

        <span className="hidden text-xs text-muted-foreground sm:block">
          {formatRelativeTime(project.updatedAt)}
        </span>

        <Button
          size="sm"
          variant="outline"
          disabled={isDeploying}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeploy(project.id);
          }}
        >
          <Play className="h-3.5 w-3.5" />
          Deploy
        </Button>
      </Card>
    </Link>
  );
}
