import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.unit.test.ts', 'test/**/*.test.ts'], // Exclude e2e
    exclude: ['test/e2e/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: [],
    watch: false,
  },
});
