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
import worker from '../src/index.js';
import type { Env as AppEnv } from '../src/app.js';

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

type CapturedDiscordRequest = {
  method: string;
  path: string;
  body: string;
  receivedAt: string;
  applicationId?: string;
  interactionToken?: string;
  channelId?: string;
};

export async function signAndSendRequest(body: object): Promise<Response> {
  const { method, headers, body: reqBody } = await signRequest(body);
  const request = new Request('http://discord-worker/', { method, headers, body: reqBody });
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

export async function clearChannelPost(channelId: string): Promise<void> {
  await fetch(`${env.MOCK_SERVER_BASE_URL}/test-api/channel-posts/${channelId}`, { method: 'DELETE' });
}

export async function runScheduled(cron: string, time: number): Promise<Response> {
  const ctrl = createScheduledController({ cron, scheduledTime: new Date(time) });
  const ctx = createExecutionContext();
  worker.scheduled!(ctrl, env as unknown as AppEnv, ctx);
  await waitOnExecutionContext(ctx);
  return new Response(null, { status: 200 });
}


