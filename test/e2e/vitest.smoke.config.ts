import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/discord-worker/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['test/e2e/discord-worker/setup.smoke.ts'],
    watch: false,
    testTimeout: 30000,
    sequence: {
      concurrent: false,
    },
    env: {
      TEST_SETUP: 'smoke',
    },
  },
});
