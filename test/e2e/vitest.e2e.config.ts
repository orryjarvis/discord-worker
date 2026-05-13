import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/discord-worker/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['test/e2e/discord-worker/setup.e2e.ts'],
    watch: false,
    testTimeout: 30000,
    sequence: {
      concurrent: false,
    },
    env: {
      TEST_SETUP: 'e2e',
    },
  },
});
