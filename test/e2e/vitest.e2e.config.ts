import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['test/e2e/setup.ts'], // Use wrangler unstable_dev setup
    watch: false,
    testTimeout: 15000,
  },
});
