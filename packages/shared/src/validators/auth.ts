import { z } from 'zod';

export const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const setupSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  githubPat: z
    .string()
    .min(1, 'GitHub PAT is required')
    .regex(
      /^(gh[ps]_|github_pat_)/,
      'Must be a valid GitHub PAT (starts with ghp_, ghs_, or github_pat_)',
    ),
  platformDomain: z.string().min(1, 'Platform domain is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
