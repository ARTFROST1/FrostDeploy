import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  percentage?: number;
  className?: string;
}

export function MetricCard({ icon: Icon, label, value, percentage, className }: MetricCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {percentage !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500',
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}
