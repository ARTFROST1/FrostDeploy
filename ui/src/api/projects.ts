import { api } from './client';
import type { Project, CreateProjectInput, UpdateProjectInput, EnvVariable } from '@fd/shared';

export function fetchProjects() {
  return api.get<Project[]>('/api/projects');
}

export function fetchProject(id: string) {
  return api.get<Project>(`/api/projects/${id}`);
}

export function createProject(data: CreateProjectInput) {
  return api.post<Project>('/api/projects', data);
}

export function updateProject(id: string, data: UpdateProjectInput) {
  return api.put<Project>(`/api/projects/${id}`, data);
}

export function deleteProject(id: string) {
  return api.delete<{ deleted: boolean }>(`/api/projects/${id}`);
}

export function detectFramework(repoUrl: string, branch?: string) {
  return api.post<{ framework: string; buildCmd: string; startCmd: string }>(
    '/api/projects/detect',
    { repo_url: repoUrl, branch },
  );
}

export function fetchCommits(projectId: string) {
  return api.get<Array<{ sha: string; message: string; author: string; date: string }>>(
    `/api/projects/${projectId}/commits`,
  );
}

export function fetchEnvVars(projectId: string) {
  return api.get<EnvVariable[]>(`/api/projects/${projectId}/env`);
}

export function updateEnvVars(
  projectId: string,
  vars: Array<{ key: string; value: string; isSecret: boolean }>,
) {
  return api.put<EnvVariable[]>(`/api/projects/${projectId}/env`, vars);
}
