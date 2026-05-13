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
      // Matches env.dev SIGNATURE_PUBLIC_KEY in wrangler.toml
      SIGNATURE_PRIVATE_KEY: 'd46b224eca160429fbbd3c903994bb93da0532635839530a1fd6cdac1bd4023e',
    },
  },
});
