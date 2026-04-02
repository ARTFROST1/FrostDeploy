import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Trash2, ArrowDown, Search } from 'lucide-react';

import { fetchProject } from '@/api/projects';
import { fetchServiceLogs } from '@/api/system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { POLLING_INTERVALS } from '@/lib/constants';

// ── Types ───────────────────────────────────────────────────────
type TimeFilter = '1h' | '6h' | '24h' | '7d';
type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

interface ParsedLine {
  timestamp: string;
  level: LogLevel;
  message: string;
  raw: string;
}

// ── Constants ───────────────────────────────────────────────────
const LINES_MAP: Record<TimeFilter, number> = {
  '1h': 200,
  '6h': 500,
  '24h': 1_000,
  '7d': 2_000,
};

const TIME_LABELS: Record<TimeFilter, string> = {
  '1h': 'Последний час',
  '6h': 'Последние 6 ч',
  '24h': 'Последние 24 ч',
  '7d': 'Последние 7 дней',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  ERROR: 'text-red-400',
  WARN: 'text-amber-400',
  INFO: 'text-zinc-500',
  DEBUG: 'text-zinc-600',
};

const LEVEL_BG: Record<LogLevel, string> = {
  ERROR: 'bg-red-500/10 text-red-400',
  WARN: 'bg-amber-500/10 text-amber-400',
  INFO: 'bg-zinc-500/10 text-zinc-500',
  DEBUG: 'bg-zinc-500/10 text-zinc-600',
};

// ── Helpers ─────────────────────────────────────────────────────
function detectLevel(text: string): LogLevel {
  const upper = text.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('ERR')) return 'ERROR';
  if (upper.includes('WARNING') || upper.includes('WARN')) return 'WARN';
  if (upper.includes('DEBUG')) return 'DEBUG';
  return 'INFO';
}

function parseLine(raw: string): ParsedLine {
  // Try JSON format first (journalctl --output=json)
  try {
    const obj = JSON.parse(raw);
    return {
      timestamp: obj.__REALTIME_TIMESTAMP
        ? new Date(Number(obj.__REALTIME_TIMESTAMP) / 1000).toISOString()
        : obj._SOURCE_REALTIME_TIMESTAMP
          ? new Date(Number(obj._SOURCE_REALTIME_TIMESTAMP) / 1000).toISOString()
          : '',
      level: detectLevel(obj.MESSAGE ?? obj.message ?? raw),
      message: obj.MESSAGE ?? obj.message ?? raw,
      raw,
    };
  } catch {
    // Plain text: try common journalctl format "Mon DD HH:MM:SS host service[pid]: message"
    const tsMatch = raw.match(/^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+\S+\s+\S+:\s*(.*)/);
    if (tsMatch) {
      return {
        timestamp: tsMatch[1] ?? '',
        level: detectLevel(tsMatch[2] ?? ''),
        message: tsMatch[2] ?? '',
        raw,
      };
    }
    // ISO timestamp prefix
    const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*)\s+(.*)/);
    if (isoMatch) {
      return {
        timestamp: isoMatch[1] ?? '',
        level: detectLevel(isoMatch[2] ?? ''),
        message: isoMatch[2] ?? '',
        raw,
      };
    }
    return { timestamp: '', level: detectLevel(raw), message: raw, raw };
  }
}

// ── Component ───────────────────────────────────────────────────
export default function ProjectLogsPage() {
  const { id } = useParams<{ id: string }>();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('1h');
  const [cleared, setCleared] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // ── Queries ─────────────────────────────────────────────────
  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  const serviceName = project?.serviceName;

  const {
    data: logsData,
    isLoading,
    error: logsError,
  } = useQuery({
    queryKey: ['service-logs', serviceName, timeFilter],
    queryFn: () => fetchServiceLogs(serviceName!, LINES_MAP[timeFilter]),
    enabled: !!serviceName,
    refetchInterval: POLLING_INTERVALS.logs,
  });

  const rawLines = logsData?.logs ?? [];
  const allLines: ParsedLine[] = cleared ? [] : rawLines.map(parseLine);
  const lines = searchFilter
    ? allLines.filter((l) => l.message.toLowerCase().includes(searchFilter.toLowerCase()))
    : allLines;

  // ── Auto-scroll ─────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (lines.length > prevLengthRef.current && isAtBottom) {
      scrollToBottom();
    }
    prevLengthRef.current = lines.length;
  }, [lines.length, isAtBottom, scrollToBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 40;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }

  // ── Handlers ────────────────────────────────────────────────
  function handleClear() {
    setCleared(true);
    // Resume on next poll
    setTimeout(() => setCleared(false), POLLING_INTERVALS.logs + 500);
  }

  function handleTimeChange(value: string) {
    setTimeFilter(value as TimeFilter);
    setCleared(false);
  }

  // ── Loading state ───────────────────────────────────────────
  if (!project || isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-[#0a0a0a] p-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="mb-2 h-4"
              style={{ width: `${55 + Math.random() * 40}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800">
            <Terminal className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Логи сервиса</h2>
            <span className="text-xs text-zinc-500 font-mono">{serviceName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Фильтр…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 w-48 border-zinc-700 bg-zinc-900 pl-7 text-xs placeholder:text-zinc-600"
            />
          </div>
          <Select value={timeFilter} onValueChange={handleTimeChange}>
            <SelectTrigger className="h-8 w-44 border-zinc-700 bg-zinc-900 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIME_LABELS) as TimeFilter[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {TIME_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-zinc-700 text-xs text-zinc-400 hover:text-zinc-100"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Очистить
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div className="relative flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-[#0a0a0a]">
        {/* Top bar accent line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full min-h-[400px] overflow-y-auto p-3 font-mono text-xs leading-relaxed"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
        >
          {logsError && lines.length === 0 ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-2 text-red-400">
              <Terminal className="h-8 w-8" />
              <p className="text-sm font-medium">Ошибка загрузки логов</p>
              <p className="text-xs text-zinc-500">{logsError.message}</p>
            </div>
          ) : lines.length === 0 ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-2 text-zinc-600">
              <Terminal className="h-8 w-8" />
              <p className="text-sm font-medium">Логов пока нет</p>
              <p className="text-xs text-zinc-700">Логи появятся после запуска проекта</p>
            </div>
          ) : (
            lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2 rounded px-2 py-0.5 hover:bg-white/[0.02] transition-colors',
                  line.level === 'ERROR' && 'bg-red-500/[0.03]',
                )}
              >
                {line.timestamp && (
                  <span className="shrink-0 select-none text-zinc-600">{line.timestamp}</span>
                )}
                <span
                  className={cn(
                    'shrink-0 select-none w-14 text-center rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wider',
                    LEVEL_BG[line.level],
                  )}
                >
                  {line.level}
                </span>
                <span
                  className={cn(
                    'break-all',
                    LEVEL_COLORS[line.level] === 'text-red-400' ? 'text-red-300' : 'text-zinc-300',
                  )}
                >
                  {line.message}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Scroll-to-bottom FAB */}
        {!isAtBottom && lines.length > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-400 shadow-lg backdrop-blur transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Footer status bar */}
      <div className="flex items-center justify-between text-[11px] text-zinc-600">
        <span>
          {lines.length} строк{searchFilter && ` (из ${allLines.length})`}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Обновление каждые 5 сек
        </span>
      </div>
    </div>
  );
}
