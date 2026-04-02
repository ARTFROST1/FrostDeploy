import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS, STATUS_TEXT_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

type Status = keyof typeof STATUS_COLORS;

const STATUS_LABELS: Record<Status, string> = {
  active: 'Active',
  success: 'Success',
  deploying: 'Deploying',
  building: 'Building',
  queued: 'Queued',
  error: 'Error',
  failed: 'Failed',
  warning: 'Warning',
  created: 'Created',
  stopped: 'Stopped',
  idle: 'Idle',
};

const ANIMATED_STATUSES = new Set<string>(['deploying', 'building']);

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status as Status;
  const label = STATUS_LABELS[key] ?? status;
  const dotColor = STATUS_COLORS[key] ?? 'bg-zinc-500';
  const textColor = (STATUS_TEXT_COLORS as Record<string, string>)[key] ?? 'text-zinc-500';
  const isAnimated = ANIMATED_STATUSES.has(status);

  return (
    <Badge variant="outline" className={cn('gap-1.5', textColor, className)}>
      <span
        className={cn('inline-block h-2 w-2 rounded-full', dotColor, isAnimated && 'animate-pulse')}
      />
      {label}
    </Badge>
  );
}
