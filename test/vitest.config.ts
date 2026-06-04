import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: [],
    watch: false,
  },
});
