import { api } from './client';
import type { Deployment, PaginatedResponse } from '@fd/shared';

export function triggerDeploy(projectId: string, sha?: string) {
  return api.post<Deployment>(`/api/projects/${projectId}/deploy`, sha ? { sha } : undefined);
}

export function fetchDeployments(projectId: string, page = 1, perPage = 15) {
  return api.get<PaginatedResponse<Deployment>>(
    `/api/projects/${projectId}/deployments?page=${page}&perPage=${perPage}`,
  );
}

export function fetchDeployment(projectId: string, deployId: string) {
  return api.get<Deployment>(`/api/projects/${projectId}/deployments/${deployId}`);
}

export function rollback(projectId: string, sha: string) {
  return api.post<Deployment>(`/api/projects/${projectId}/rollback/${sha}`);
}
