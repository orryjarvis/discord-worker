import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: [],
    watch: false,
  },
});
