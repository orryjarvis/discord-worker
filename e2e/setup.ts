/**
 * Runs inside the Workers runtime (via cloudflare:test setupFiles).
 * All helpers call the worker directly via its exported handler; outbound
 * Discord API / RSS calls are intercepted by the Node mock server started
 * in globalSetup.ts.
 */
import { env } from 'cloudflare:workers';
import {
  createExecutionContext,
  createScheduledController,
  waitOnExecutionContext,
  SELF,
} from 'cloudflare:test';
import * as ed from '@noble/ed25519';
import worker from '@/index';
import type { Env as AppEnv } from '@/app';

// Replace the AI binding with a lightweight stub so e2e tests run without
// Cloudflare credentials. env is the same object the fetch handler receives,
// so this assignment is visible to all SELF.fetch() dispatches.
(env as unknown as Record<string, unknown>).AI = {
  run: (_model: string, _inputs: unknown): Promise<{ response: string }> => {
    return Promise.resolve({ response: 'Mock AI output for testing.' });
  },
};

// Keypair generated via scripts/generate_test_keys.ts — matches SIGNATURE_PUBLIC_KEY in wrangler.jsonc dev env.
const PRIVATE_KEY_HEX = 'd46b224eca160429fbbd3c903994bb93da0532635839530a1fd6cdac1bd4023e';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function signRequest(body: object): Promise<{ method: 'POST'; headers: Record<string, string>; body: string }> {
  const timestamp = Date.now().toString();
  const json = JSON.stringify(body);
  const message = new TextEncoder().encode(timestamp + json);
  const signatureBytes = await ed.signAsync(message, hexToBytes(PRIVATE_KEY_HEX));
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': bytesToHex(signatureBytes),
      'x-signature-timestamp': timestamp,
    },
    body: JSON.stringify(body),
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(new Uint8Array(signature));
}

type CapturedDiscordRequest = {
  method: string;
  path: string;
  body: string;
  receivedAt: string;
  applicationId?: string;
  interactionToken?: string;
  channelId?: string;
};

type CapturedGitHubIssueRequest = {
  method: string;
  path: string;
  body: string;
  receivedAt: string;
};

export async function signAndSendRequest(body: object): Promise<Response> {
  const { method, headers, body: reqBody } = await signRequest(body);
  const request = new Request('http://discord-worker/discord', { method, headers, body: reqBody });
  return SELF.fetch(request);
}

export async function signAndSendGitHubWebhook(
  body: object,
  {
    event = 'workflow_run',
    deliveryId = `delivery-${Date.now()}`,
  }: {
    event?: string;
    deliveryId?: string;
  } = {},
): Promise<Response> {
  const payload = JSON.stringify(body);
  const githubWebhookSecret = (env as unknown as { GITHUB_WEBHOOK_SECRET?: string }).GITHUB_WEBHOOK_SECRET;
  if (!githubWebhookSecret) {
    throw new Error('GITHUB_WEBHOOK_SECRET is required in e2e bindings');
  }

  const signature = await computeHmacSha256Hex(githubWebhookSecret, payload);
  const request = new Request('http://discord-worker/github', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${signature}`,
      'x-github-event': event,
      'x-github-delivery': deliveryId,
    },
    body: payload,
  });

  return SELF.fetch(request);
}

export async function waitForFollowUp(correlationId: string, timeoutMs = 25000): Promise<CapturedDiscordRequest> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${env.MOCK_SERVER_BASE_URL}/test-api/follow-ups/${correlationId}`);
    if (res.status === 200) return res.json() as Promise<CapturedDiscordRequest>;
    await new Promise<void>(r => setTimeout(r, 500));
  }
  throw new Error(`No follow-up for correlationId "${correlationId}" received within ${timeoutMs}ms`);
}

export async function waitForChannelPost(channelId: string, timeoutMs = 25000): Promise<CapturedDiscordRequest> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${env.MOCK_SERVER_BASE_URL}/test-api/channel-posts/${channelId}`);
    if (res.status === 200) return res.json() as Promise<CapturedDiscordRequest>;
    await new Promise<void>(r => setTimeout(r, 500));
  }
  throw new Error(`No channel post for channelId "${channelId}" received within ${timeoutMs}ms`);
}

export async function waitForGitHubIssue(repoSlug: string, timeoutMs = 25000): Promise<CapturedGitHubIssueRequest> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${env.MOCK_SERVER_BASE_URL}/test-api/github-issues/${repoSlug}`);
    if (res.status === 200) return res.json() as Promise<CapturedGitHubIssueRequest>;
    await new Promise<void>(r => setTimeout(r, 500));
  }
  throw new Error(`No GitHub issue for repoSlug "${repoSlug}" received within ${timeoutMs}ms`);
}

export async function clearChannelPost(channelId: string): Promise<void> {
  await fetch(`${env.MOCK_SERVER_BASE_URL}/test-api/channel-posts/${channelId}`, { method: 'DELETE' });
}

export async function clearReleases(): Promise<void> {
  const runtimeEnv = env as unknown as AppEnv;
  const db = runtimeEnv.RELEASES_DB;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS releases (
      title_normalized TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      year INTEGER,
      quarter INTEGER,
      month INTEGER,
      day INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS scheduled_messages (
      schedule_key TEXT PRIMARY KEY,
      schedule_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      scheduled_for INTEGER NOT NULL,
      content TEXT NOT NULL,
      allowed_mentions_json TEXT NOT NULL DEFAULT '{"parse":[]}',
      status TEXT NOT NULL DEFAULT 'scheduled',
      attempts INTEGER NOT NULL DEFAULT 0,
      fired_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (schedule_type IN ('reminder', 'release')),
      CHECK (status IN ('scheduled', 'firing', 'fired', 'canceled'))
    )`,
  ).run();
  await db.prepare('DELETE FROM releases').run();
  await db.prepare('DELETE FROM scheduled_messages').run();
}

export async function getReleaseByNormalizedTitle(titleNormalized: string): Promise<Record<string, unknown> | null> {
  const runtimeEnv = env as unknown as AppEnv;
  const db = runtimeEnv.RELEASES_DB;
  const result = await db.prepare(
    `SELECT title_normalized, title, channel_id, year, quarter, month, day
     FROM releases
     WHERE title_normalized = ?`,
  ).bind(titleNormalized).first<Record<string, unknown>>();

  return result ?? null;
}

export async function runScheduled(cron: string, time: number): Promise<Response> {
  const ctrl = createScheduledController({ cron, scheduledTime: new Date(time) });
  const ctx = createExecutionContext();
  worker.scheduled!(ctrl, env as unknown as AppEnv, ctx);
  await waitOnExecutionContext(ctx);
  return new Response(null, { status: 200 });
}


