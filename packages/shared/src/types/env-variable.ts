export interface EnvVariable {
  id: string;
  projectId: string;
  key: string;
  value?: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}
