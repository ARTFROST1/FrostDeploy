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

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  description: string;
}

export interface DnsRecordsResponse {
  domain: string;
  serverIp: string;
  isDirect: boolean;
  records: DnsRecord[];
}

export interface DnsVerifyResponse {
  domain: string;
  verified: boolean;
  actualIp?: string;
  serverIp: string;
}

export function fetchDnsRecords() {
  return api.get<DnsRecordsResponse>('/api/settings/dns-records');
}

export function verifyDns(domain?: string) {
  return api.post<DnsVerifyResponse>('/api/settings/dns-verify', { domain });
}

export interface AdminDomainSuggestion {
  suggestion: string | null;
}

export function fetchAdminDomainSuggestion() {
  return api.get<AdminDomainSuggestion>('/api/settings/admin-domain-suggestion');
}
