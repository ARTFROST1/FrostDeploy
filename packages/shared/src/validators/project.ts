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
  rootDir: z
    .string()
    .max(255)
    .regex(
      /^(?!.*\.\.)(?!\/)[a-zA-Z0-9][a-zA-Z0-9/_. -]*$/,
      'Invalid path: no ".." or leading "/" allowed',
    )
    .optional(),
  extraPath: z
    .string()
    .max(512)
    .regex(/^[\w/.:-]+$/, 'Invalid PATH entry')
    .optional(),
  runUser: z
    .string()
    .max(64)
    .regex(/^[a-z_][a-z0-9_-]*$/, 'Invalid Unix username')
    .optional(),
  limitNofile: z.number().int().min(1024).max(1048576).optional(),
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
  rootDir: z
    .string()
    .max(255)
    .regex(
      /^(?!.*\.\.)(?!\/)[a-zA-Z0-9][a-zA-Z0-9\/_. -]*$/,
      'Invalid path: no ".." or leading "/" allowed',
    )
    .optional()
    .nullable(),
  extraPath: z
    .string()
    .max(512)
    .regex(/^[\w/.:-]+$/, 'Invalid PATH entry')
    .optional()
    .nullable(),
  runUser: z
    .string()
    .max(64)
    .regex(/^[a-z_][a-z0-9_-]*$/, 'Invalid Unix username')
    .optional()
    .nullable(),
  limitNofile: z.number().int().min(1024).max(1048576).optional().nullable(),
});

export const detectRepoSchema = z.object({
  repoUrl: z
    .string()
    .url('Must be a valid URL')
    .regex(/github\.com/, 'Must be a GitHub repository URL'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type DetectRepoInput = z.infer<typeof detectRepoSchema>;
