import { api } from './client';
import type { LoginInput, SetupInput, ChangePasswordInput } from '@fd/shared';

export function login(data: LoginInput) {
  return api.post<{ authenticated: boolean }>('/api/auth/login', data);
}

export function logout() {
  return api.post<{ loggedOut: boolean }>('/api/auth/logout');
}

export function checkAuth() {
  return api.get<{ authenticated: boolean }>('/api/auth/check');
}

export function setup(data: SetupInput) {
  return api.post<{ completed: boolean }>('/api/settings/setup', data);
}

// TODO: Phase 5 — server endpoint not yet implemented
export function changePassword(data: ChangePasswordInput) {
  return api.put<{ changed: boolean }>('/api/settings/password', data);
}
