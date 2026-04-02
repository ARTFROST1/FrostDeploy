export type SslStatus = 'pending' | 'provisioning' | 'active' | 'error';

export interface Domain {
  id: string;
  projectId: string;
  domain: string;
  isPrimary: boolean;
  sslStatus: SslStatus;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
