import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectStatus } from '@fd/shared';
import { fetchProject } from '@/api/projects';

const POLL_NORMAL = 5_000;
const POLL_DEPLOYING = 2_000;

export function useDeployStatus(projectId: string) {
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<ProjectStatus | undefined>(undefined);

  const { data: status } = useQuery({
    queryKey: ['deploy-status', projectId],
    queryFn: () => fetchProject(projectId),
    select: (project) => project.status,
    refetchInterval: (query) =>
      query.state.data?.status === 'deploying' ? POLL_DEPLOYING : POLL_NORMAL,
    enabled: !!projectId,
  });

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev === 'deploying' && status && status !== 'deploying') {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['deployments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  }, [status, projectId, queryClient]);

  return {
    status: status ?? ('created' as ProjectStatus),
    isDeploying: status === 'deploying',
  };
}
