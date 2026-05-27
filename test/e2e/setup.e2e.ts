import { beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import * as http from 'node:http';
import * as net from 'net';
import appWorker from '../../src/index.js';
import { signRequest } from './setup.shared';

let worker: Unstable_DevWorker;
let discordProxyServer: http.Server;
let discordProxyPort: number;

type CapturedDiscordRequest = {
  method: string;
  path: string;
  body: string;
  receivedAt: string;
  applicationId?: string;
  interactionToken?: string;
  channelId?: string;
};

const followUpsByCorrelationId = new Map<string, CapturedDiscordRequest[]>();
const channelPostsByChannelId = new Map<string, CapturedDiscordRequest[]>();
const scheduledFallbackKv = new Map<string, string>();

const WEBHOOK_PATH_RE = /^\/api\/v10\/webhooks\/([^/]+)\/([^/]+)(?:\/messages\/@original)?$/;
const CHANNEL_MESSAGE_PATH_RE = /^\/api\/v10\/channels\/([^/]+)\/messages$/;
const MOCK_WORD_OF_DAY_FEED_PATH = '/mock/wotd/feed/rss2';
const MOCK_WORD_OF_DAY_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:merriam="https://www.merriam-webster.com/word-of-the-day" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
  <channel>
    <item>
      <title><![CDATA[ benevolent ]]></title>
      <link><![CDATA[ https://www.merriam-webster.com/word-of-the-day/benevolent-2026-05-22 ]]></link>
      <description><![CDATA[<p><strong>benevolent</strong> &#149; \\buh-NEV-uh-lunt\\ &#149; <em>adjective</em></p>]]></description>
      <itunes:summary><![CDATA[ Merriam-Webster's Word of the Day for May 22, 2026 is: benevolent \\buh-NEV-uh-lunt\\ adjective ]]></itunes:summary>
      <merriam:shortdef><![CDATA[ marked by or disposed to doing good ]]></merriam:shortdef>
    </item>
  </channel>
</rss>`;

function enqueueFollowUp(correlationId: string, entry: CapturedDiscordRequest): void {
  const entries = followUpsByCorrelationId.get(correlationId) ?? [];
  entries.push(entry);
  followUpsByCorrelationId.set(correlationId, entries);
}

function enqueueChannelPost(channelId: string, entry: CapturedDiscordRequest): void {
  const entries = channelPostsByChannelId.get(channelId) ?? [];
  entries.push(entry);
  channelPostsByChannelId.set(channelId, entries);
}

function dequeueFollowUp(correlationId: string): CapturedDiscordRequest | null {
  const entries = followUpsByCorrelationId.get(correlationId);
  if (!entries || entries.length === 0) {
    return null;
  }

  const entry = entries.shift() ?? null;
  if (entries.length === 0) {
    followUpsByCorrelationId.delete(correlationId);
  }
  return entry;
}

function dequeueChannelPost(channelId: string): CapturedDiscordRequest | null {
  const entries = channelPostsByChannelId.get(channelId);
  if (!entries || entries.length === 0) {
    return null;
  }

  const entry = entries.shift() ?? null;
  if (entries.length === 0) {
    channelPostsByChannelId.delete(channelId);
  }
  return entry;
}

async function readRequestBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function startDiscordProxyServer(port: number): Promise<http.Server> {
  const server = http.createServer((request, response) => {
    void (async () => {
      const method = request.method ?? 'GET';
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const path = url.pathname;
      const body = await readRequestBody(request);
      const entry: CapturedDiscordRequest = {
        method,
        path,
        body,
        receivedAt: new Date().toISOString(),
      };

      if (method === 'GET' && path === MOCK_WORD_OF_DAY_FEED_PATH) {
        response.writeHead(200, {
          'content-type': 'application/rss+xml; charset=utf-8',
        });
        response.end(MOCK_WORD_OF_DAY_FEED_XML);
        return;
      }

      const webhookMatch = WEBHOOK_PATH_RE.exec(path);
      if (webhookMatch) {
        const applicationId = webhookMatch[1];
        const interactionToken = webhookMatch[2];
        const correlationMatch = /^test-token-(.+)$/.exec(interactionToken);

        if (correlationMatch) {
          entry.applicationId = applicationId;
          entry.interactionToken = interactionToken;
          enqueueFollowUp(correlationMatch[1], entry);
        }

        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{}');
        return;
      }

      const channelPostMatch = CHANNEL_MESSAGE_PATH_RE.exec(path);
      if (channelPostMatch) {
        const channelId = channelPostMatch[1];
        entry.channelId = channelId;
        enqueueChannelPost(channelId, entry);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{}');
        return;
      }

      response.writeHead(404);
      response.end('Not Found');
    })().catch(() => {
      response.writeHead(500);
      response.end('Internal Server Error');
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  return server;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error('Could not allocate free port'));
      });
    });
    server.on('error', reject);
  });
}

beforeAll(async () => {
  scheduledFallbackKv.clear();

  const workerPort = await getFreePort();
  discordProxyPort = await getFreePort();

  discordProxyServer = await startDiscordProxyServer(discordProxyPort);

  worker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    env: 'dev',
    logLevel: 'log',
    local: true,
    port: workerPort,
    vars: {
      DISCORD_API_BASE_URL: `http://127.0.0.1:${discordProxyPort}/api/v10`,
      WORD_OF_DAY_FEED_URL: `http://127.0.0.1:${discordProxyPort}${MOCK_WORD_OF_DAY_FEED_PATH}`,
    },
  });
});

afterAll(async () => {
  scheduledFallbackKv.clear();

  await worker.stop();
  await new Promise<void>((resolve, reject) => {
    discordProxyServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

export async function signAndSendRequest(body: object): Promise<any> {
  const request = await signRequest(body);
  return await worker.fetch('/', request);
}

export async function waitForFollowUp(correlationId: string, timeoutMs = 15000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const followUp = dequeueFollowUp(correlationId);
    if (followUp) {
      return followUp;
    }
    await new Promise<void>(r => setTimeout(r, 1000));
  }
  throw new Error(`No follow-up for correlationId "${correlationId}" received within ${timeoutMs}ms`);
}

export async function waitForChannelPost(channelId: string, timeoutMs = 15000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const post = dequeueChannelPost(channelId);
    if (post) {
      return post;
    }
    await new Promise<void>(r => setTimeout(r, 1000));
  }
  throw new Error(`No channel post for channelId "${channelId}" received within ${timeoutMs}ms`);
}

export function clearChannelPost(channelId: string): Promise<void> {
  channelPostsByChannelId.delete(channelId);
  return Promise.resolve();
}

function createFallbackExecutionContext(): {
  ctx: { waitUntil: (promise: Promise<unknown>) => void };
  drain: () => Promise<void>;
} {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise);
      },
    },
    drain: async () => {
      await Promise.all(pending);
    },
  };
}

const scheduledFallbackEnv = {
  DISCORD_TOKEN: 'not-a-real-token',
  DISCORD_API_BASE_URL: () => `http://127.0.0.1:${discordProxyPort}/api/v10`,
  WORD_OF_DAY_CHANNEL_ID: 'test-word-of-day-channel',
  WORD_OF_DAY_FEED_URL: () => `http://127.0.0.1:${discordProxyPort}${MOCK_WORD_OF_DAY_FEED_PATH}`,
  KV: {
    get(key: string): Promise<string | null> {
      return Promise.resolve(scheduledFallbackKv.get(key) ?? null);
    },
    put(key: string, value: string): Promise<void> {
      scheduledFallbackKv.set(key, value);
      return Promise.resolve();
    },
    delete(key: string): Promise<void> {
      scheduledFallbackKv.delete(key);
      return Promise.resolve();
    },
  },
};

export async function runScheduled(cron: string, time: number): Promise<any> {
  const scheduledWorker = worker as Unstable_DevWorker & {
    scheduled?: (controller: { cron: string; scheduledTime: number }) => Promise<unknown>;
  };

  if (typeof scheduledWorker.scheduled === 'function') {
    await scheduledWorker.scheduled({
      cron,
      scheduledTime: time,
    });

    return new globalThis.Response(null, { status: 200 });
  }

  // Keep fallback runs independent when tests rerun in the same process.
  scheduledFallbackKv.clear();

  const { ctx, drain } = createFallbackExecutionContext();
  appWorker.scheduled({
    cron,
    scheduledTime: time,
    noRetry: () => {
      // No-op in local e2e fallback path.
    },
  }, {
    ...scheduledFallbackEnv,
    DISCORD_API_BASE_URL: scheduledFallbackEnv.DISCORD_API_BASE_URL(),
    WORD_OF_DAY_FEED_URL: scheduledFallbackEnv.WORD_OF_DAY_FEED_URL(),
  } as any, ctx as any);
  await drain();

  return new globalThis.Response(null, { status: 200 });
}


