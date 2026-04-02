import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface LogLine {
  message: string;
  timestamp: string;
  type?: 'log' | 'error' | 'info';
}

interface DeployLogProps {
  lines: LogLine[];
  isStreaming: boolean;
}

const typeColor: Record<string, string> = {
  log: 'text-zinc-300',
  error: 'text-red-400',
  info: 'text-emerald-400',
};

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DeployLog({ lines, isStreaming }: DeployLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines.length, isStreaming]);

  return (
    <div
      className="flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-[#0a0a0a]"
      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
    >
      <ScrollArea className="h-full p-4">
        {lines.length === 0 ? (
          <p className="animate-pulse text-zinc-600">Ожидание логов...</p>
        ) : (
          <div className="space-y-px">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-3 leading-5">
                <span className="shrink-0 select-none text-zinc-600">
                  {formatTs(line.timestamp)}
                </span>
                <span className={cn(typeColor[line.type ?? 'log'])}>{line.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {isStreaming && lines.length > 0 && (
          <div className="mt-1 flex items-center gap-2 text-zinc-600">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-blue-500" />
            streaming…
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
