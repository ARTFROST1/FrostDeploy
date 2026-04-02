import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared/vitest.config.ts',
  'packages/db/vitest.config.ts',
  'server/vitest.config.ts',
]);
