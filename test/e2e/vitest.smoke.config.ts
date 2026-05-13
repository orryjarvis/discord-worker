import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(rootDir, '../../src'),
    },
  },
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
