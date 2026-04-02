import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared',
    root: import.meta.dirname,
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
