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
