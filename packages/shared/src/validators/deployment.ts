import { z } from 'zod';

export const triggerDeploySchema = z.object({
  sha: z.string().length(40, 'SHA must be 40 characters').optional(),
  force: z.boolean().default(false),
});

export const cancelDeploySchema = z.object({
  reason: z.string().max(200).optional(),
});

export type TriggerDeployInput = z.infer<typeof triggerDeploySchema>;
export type CancelDeployInput = z.infer<typeof cancelDeploySchema>;
