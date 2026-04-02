import { z } from 'zod';

export const createEnvVarSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .max(128, 'Key must be 128 characters or less')
    .regex(/^[A-Z_][A-Z0-9_]*$/, 'Key must be uppercase with underscores (e.g. DATABASE_URL)'),
  value: z.string().min(1, 'Value is required'),
  isSecret: z.boolean().default(true),
});

export const updateEnvVarsSchema = z.array(
  z.object({
    key: z.string().min(1),
    value: z.string(),
    isSecret: z.boolean().default(true),
  }),
);

export type CreateEnvVarInput = z.infer<typeof createEnvVarSchema>;
export type UpdateEnvVarsInput = z.infer<typeof updateEnvVarsSchema>;
