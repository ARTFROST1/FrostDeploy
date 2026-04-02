import { z } from 'zod';

export const createProjectSchema = z.object({
  repoUrl: z
    .string()
    .url('Must be a valid URL')
    .regex(/github\.com/, 'Must be a GitHub repository URL'),
  branch: z.string().min(1).default('main'),
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(64, 'Project name must be 64 characters or less')
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Name must be lowercase alphanumeric with hyphens'),
  domain: z.string().optional(),
  envVars: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string(),
        isSecret: z.boolean().default(true),
      }),
    )
    .optional(),
});

export const updateProjectSchema = z.object({
  branch: z.string().min(1).optional(),
  buildCmd: z.string().optional(),
  startCmd: z.string().optional(),
  domain: z.string().nullable().optional(),
  outputDir: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
