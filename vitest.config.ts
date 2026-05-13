import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  test: {
    include: ['test/**/*.unit.test.ts', 'test/**/*.test.ts'], // Exclude e2e
    exclude: ['test/e2e/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: [],
    watch: false,
  },
});
