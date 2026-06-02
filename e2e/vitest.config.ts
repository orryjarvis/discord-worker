import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
          GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCoSLK15/DYgJp8
wd+KqyDC8Tb19e+46vRHAohTuJxkHQtnE7BrRjX/DQo4VZ+sRrKqJDM3g58CNkyC
1ylYhbV2KHEzIFOGkqfc+XKrUTzrp8yrZvH9FJz0k/LYtlB7Ai+YMVNz0OR1b5tb
gbg3VhIZ3tgNDcgB3U86evJoSIFKEATBLJh20eD+6/pUOn2PxrndeICjD4fx+ZHn
NI8V8B7zkyBAZcW8AkfXbKTdcekIZXBEBKkSDSfMa7osPW/AlpwQ9aKi1k7Xziip
TmxNUxHYD5DtqNduvmVebKPcbdbGrN031l5rUgBU5Po5I4gtYweLZcqTKy3nAd8/
1oahuV8fAgMBAAECggEABBB5bHufwq2HIv3ltxTUqOX9hKmTcse4mEx0hsfIfdcr
vX9pZ+CIEP27d5/Ycuc5jR1sX+oIZEZzyPHcYvHGb7D2BvJAF4R26cHb5feuJ9I4
1xJDREWurW4zU85CGa50VXx/flEXFh+uGg2DKab6WfCauY9R0NBhB6cM2r2W4yHU
yu7tBy0TlGOUy5G8t2uvZktWvjFUzcL9UEceazjlXGrH259BXkgcQ7DwDecd+4mn
UNw6Xi1TcHYYtiaIl+qNaI3zJATMfprzQ3C71BJIQWRk+hr198wYGd/l7YL5weAy
WeYyEaZOucHNaYdWpbauAMuimly32IYzOuLZO8feAQKBgQC1Z1seE8wprnfp5hgD
i3MQU6aJr6x7JM8/Tpby/SqBjQ/dc+JRX2SLX6XG6xWFuIU239UAEZ3p4fOywEYX
tmglVZbsgxmfgHkVsQ3p0eKMg/cq3ahFhwA6CXHDw2/lKVxyL4VyyorhQfvgCgu5
DHNTZM7odcIbdJx0Q8lgO+5VHwKBgQDtfDSgyE49bOSMWVixTgpDdbMRM15An1+u
4HbJ1vLcPOWa/L8HUbq7t99GuRsXphXxqNXw6IwXwPpcE8D9BJP7Jhx56N1achTc
Bj4YF4XswcgQekW6FOkuKtkay5A3ghicE6FH8zOxYURLKcTkLDtcXAVBzwZTc8Nz
64PDctm2AQKBgFFKzPlwk8iGB/TIiTBleJ3zbqk7EYdp2nobROgFbdv6lAaAnQYs
Qol2xnqa9N0k8IXDztcmDec2u5f6NC8CLi+06Fp68auZzilbW8nRpb2kkcoi5Pqr
Yf2gJ9w7o9RFMcl15E6p14zUngQrXE+D9daEUXi49NCK9GXhzseSc96vAoGBALcX
EQP8KcXVlAZYQ7a+cc88iMd0EPBFbuFGEI7f9vCwylvJDAW6jvp2cd72itqao0Ri
ZD6NKqSNlPc0C4+F3gi8gyvByhYW6doPvgOY7xlu9K0vd15VDMkZI7QyyIbi99Is
mCT+bRYN5TcFhtRa/ZDhKPRphXkFQOS36Cfg/dQBAoGAT0C+Nae89sNX0DPuxyXP
GWkKn4TPUtbt3gHDFqaipblYHDZhRo+i1nDjnEBKj+godnycDGLtuiWNgVPZNXEH
QSUKFupIVyaYYOv1zS2wS3rSGPGk0xnAvq/yfW89igbkGKWGyFVe/N4RD8arjQgH
horbP5Rn2lF5iT9iWIMBKGM=
-----END PRIVATE KEY-----`,
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
