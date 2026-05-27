import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['test/e2e/setup.e2e.ts'],
    watch: false,
    testTimeout: 15000,
    sequence: {
      concurrent: false,
    },
  },
});
