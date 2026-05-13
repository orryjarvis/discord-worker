import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/cli-local/**/*.test.ts'],
    globals: true,
    environment: 'node',
    watch: false,
    testTimeout: 30000,
    sequence: {
      concurrent: false,
    },
  },
});
