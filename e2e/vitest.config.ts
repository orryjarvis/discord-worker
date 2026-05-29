import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['e2e/setup.ts'],
    watch: false,
    testTimeout: 15000,
    sequence: {
      concurrent: false,
    },
  },
});
