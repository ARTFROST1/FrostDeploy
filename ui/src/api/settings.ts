import { api } from './client';

interface PlatformSettings {
  github_pat?: string;
  platform_domain?: string;
  setup_completed?: string;
  [key: string]: string | undefined;
}

export function fetchSettings() {
  return api.get<PlatformSettings>('/api/settings');
}

export function updateSettings(data: Partial<PlatformSettings>) {
  return api.put<PlatformSettings>('/api/settings', data);
}

export function checkSetupStatus() {
  return api.get<{ completed: boolean }>('/api/settings/setup-status');
}
