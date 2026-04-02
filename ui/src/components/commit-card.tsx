import { Play, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime, shortSha, truncate } from '@/lib/utils';

interface CommitCardProps {
  commit: { sha: string; message: string; author: string; date: string };
  isCurrent: boolean;
  isDeploying: boolean;
  onDeploy: (sha: string) => void;
}

export function CommitCard({ commit, isCurrent, isDeploying, onDeploy }: CommitCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors',
        isCurrent ? 'bg-accent/20 border-accent/40' : 'bg-card hover:bg-muted/50',
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          'h-2.5 w-2.5 shrink-0 rounded-full',
          isCurrent ? 'bg-emerald-500' : 'bg-zinc-500',
        )}
      />

      {/* Commit info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{shortSha(commit.sha)}</span>
          <span className="truncate text-sm text-foreground">{truncate(commit.message, 50)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>@{commit.author}</span>
          <span>·</span>
          <span>{formatRelativeTime(commit.date)}</span>
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">
        {isCurrent ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
            <Check className="h-3.5 w-3.5" />
            Текущий
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isDeploying}
            onClick={() => onDeploy(commit.sha)}
            className="gap-1"
          >
            <Play className="h-3 w-3" />
            Deploy
          </Button>
        )}
      </div>
    </div>
  );
}
