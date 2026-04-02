import { useQuery } from '@tanstack/react-query';
import { fetchSystemMetrics } from '@/api/system';
import { POLLING_INTERVALS } from '@/lib/constants';

export function useSystemMetrics() {
  const {
    data: metrics,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: fetchSystemMetrics,
    refetchInterval: POLLING_INTERVALS.systemMetrics,
  });

  return { metrics, isLoading, error };
}
