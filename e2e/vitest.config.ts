import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(({ inject }) => ({
      wrangler: { configPath: './wrangler.jsonc', environment: 'dev' },
      miniflare: {
        queueConsumers: {
          'discord-follow-up-queue-dev': { maxBatchTimeout: 0.05 },
        },
        bindings: {
          DISCORD_API_BASE_URL: `${inject('mockServerBaseUrl')}/api/v10`,
          WORD_OF_DAY_FEED_URL: `${inject('mockServerBaseUrl')}/mock/wotd/feed/rss2`,
          MOCK_SERVER_BASE_URL: inject('mockServerBaseUrl'),
        },
      },
    })),
  ],
  test: {
    globalSetup: ['./e2e/globalSetup.ts'],
    setupFiles: ['./e2e/setup.ts'],
    include: ['e2e/**/*.test.ts'],
    watch: false,
    testTimeout: 30000,
    sequence: {
      concurrent: false,
    },
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['discord-api-types/v10'],
        },
      },
    },
  },
});
