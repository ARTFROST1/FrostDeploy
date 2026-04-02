import { api } from './client';
import type { Deployment, PaginatedResponse } from '@fd/shared';

/**
 * POST triggers a deploy; the response is an SSE stream (not JSON).
 * We only need to verify it started successfully — the bridge buffers events
 * and the client reconnects via GET /deploy/stream.
 */
export async function triggerDeploy(projectId: string, sha?: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(sha ? { sha } : {}),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({ error: { message: 'Deploy failed' } }));
    throw new Error(json.error?.message ?? `Deploy failed (${res.status})`);
  }

  // 200 = SSE stream started, don't consume the body — bridge buffers events
}

export function fetchDeployments(projectId: string, page = 1, perPage = 15) {
  return api.get<PaginatedResponse<Deployment>>(
    `/api/projects/${projectId}/deployments?page=${page}&perPage=${perPage}`,
  );
}

export function fetchDeployment(projectId: string, deployId: string) {
  return api.get<Deployment>(`/api/projects/${projectId}/deployments/${deployId}`);
}

export async function rollback(projectId: string, sha: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/rollback/${sha}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({ error: { message: 'Rollback failed' } }));
    throw new Error(json.error?.message ?? `Rollback failed (${res.status})`);
  }
}
