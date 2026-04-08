import { api } from './client';
import type {
  Project,
  CreateProjectInput as BaseCreateProjectInput,
  UpdateProjectInput as BaseUpdateProjectInput,
  EnvVariable,
} from '@fd/shared';

export interface CreateProjectInput extends BaseCreateProjectInput {
  rootDir?: string;
}

export interface UpdateProjectInput extends BaseUpdateProjectInput {
  rootDir?: string | null;
}

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

export function setProjectDomain(projectId: string, domain: string) {
  return api.put<Project>(`/api/projects/${projectId}/domain`, { domain });
}

export function removeProjectDomain(projectId: string) {
  return api.delete<{ removed: boolean }>(`/api/projects/${projectId}/domain`);
}

export function fetchProjectDnsRecords(projectId: string) {
  return api.get<{
    domain: string;
    serverIp: string;
    records: Array<{ type: string; name: string; value: string; description: string }>;
  }>(`/api/projects/${projectId}/dns-records`);
}

export function verifyProjectDns(projectId: string) {
  return api.post<{
    verified: boolean;
    sslStatus?: string;
    actualIp?: string;
    expectedIp?: string;
  }>(`/api/projects/${projectId}/dns-verify`, {});
}

export function fetchProjectSslStatus(projectId: string) {
  return api.get<{ sslStatus: string; domain: string }>(`/api/projects/${projectId}/ssl-status`);
}
