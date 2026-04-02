import { api } from './client';
import type { SystemMetrics } from '@fd/shared';

export function fetchSystemMetrics() {
  return api.get<SystemMetrics>('/api/system');
}

export function fetchServiceLogs(serviceName: string, lines = 200) {
  return api.get<{ logs: string[] }>(`/api/system/logs/${serviceName}?lines=${lines}`);
}
