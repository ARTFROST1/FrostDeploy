import { useCallback, useEffect, useRef, useState } from 'react';

export interface SSEEvent {
  type: 'step' | 'log' | 'status' | 'complete' | 'error';
  [key: string]: unknown;
}

type SSEStatus = 'connecting' | 'connected' | 'closed' | 'error';

interface UseSSEReturn {
  events: SSEEvent[];
  status: SSEStatus;
  isComplete: boolean;
  error: string | null;
}

const EVENT_NAMES = ['step', 'log', 'status', 'complete', 'error'] as const;
const MAX_RETRIES = 3;

export function useSSE(url: string | null): UseSSEReturn {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [status, setStatus] = useState<SSEStatus>('connecting');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retriesRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!url) {
      setStatus('closed');
      return;
    }

    setEvents([]);
    setStatus('connecting');
    setIsComplete(false);
    setError(null);
    retriesRef.current = 0;

    function connect() {
      cleanup();

      const es = new EventSource(url!, { withCredentials: true });
      esRef.current = es;

      es.onopen = () => {
        setStatus('connected');
        retriesRef.current = 0;
      };

      const handleEvent = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as SSEEvent;
          setEvents((prev) => [...prev, data]);

          if (data.type === 'complete') {
            setIsComplete(true);
            setStatus('closed');
            es.close();
          } else if (data.type === 'error') {
            setError((data.error as string) ?? 'Deploy failed');
            setIsComplete(true);
            setStatus('closed');
            es.close();
          }
        } catch {
          // skip malformed events
        }
      };

      for (const name of EVENT_NAMES) {
        es.addEventListener(name, handleEvent);
      }

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          // server closed normally
          setStatus('closed');
          return;
        }

        retriesRef.current += 1;
        if (retriesRef.current >= MAX_RETRIES) {
          setStatus('error');
          setError('Connection lost');
          es.close();
        }
        // otherwise EventSource auto-reconnects
      };
    }

    connect();

    return cleanup;
  }, [url, cleanup]);

  return { events, status, isComplete, error };
}
