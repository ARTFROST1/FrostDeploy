export type SettingsKey =
  | 'admin_password_hash'
  | 'github_pat'
  | 'platform_domain'
  | 'server_name'
  | 'port_range_start'
  | 'port_range_end'
  | 'encryption_key_id'
  | 'setup_completed'
  | 'session_secret';

export interface Settings {
  key: SettingsKey;
  value: string;
  isEncrypted: boolean;
  updatedAt: string;
}
