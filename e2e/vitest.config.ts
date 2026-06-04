import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const { privateKey: TEST_GITHUB_PRIVATE_KEY } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  plugins: [
    cloudflareTest(({ inject }) => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        durableObjects: {
          REMINDER_SCHEDULER: 'ReminderDurableObject',
        },
        kvNamespaces: ['KV'],
        queueProducers: { FOLLOW_UP_QUEUE: 'discord-follow-up-queue-dev' },
        queueConsumers: {
          'discord-follow-up-queue-dev': { maxBatchTimeout: 0.05 },
        },
        bindings: {
          DISCORD_APPLICATION_ID: 'TEST_APPLICATION',
          DISCORD_TOKEN: 'not-a-real-token',
          SIGNATURE_PUBLIC_KEY: '04762816e9bab4e08bfcce909351a221ca8f7751affa16ef757881eba6560d1e',
          WORD_OF_DAY_CHANNEL_ID: 'test-word-of-day-channel',
          GITHUB_APP_ID: '123456',
          GITHUB_APP_INSTALLATION_ID: '987654',
          GITHUB_APP_PRIVATE_KEY: TEST_GITHUB_PRIVATE_KEY,
          GITHUB_ISSUE_REPOSITORY: 'oaj/discord-worker',
          GITHUB_API_BASE_URL: `${inject('mockServerBaseUrl')}/api/github`,
          GITHUB_WEBHOOK_SECRET: 'github-e2e-secret',
          GITHUB_DEPLOY_WORKFLOW_PATH: '.github/workflows/prod.yaml',
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
