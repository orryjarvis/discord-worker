import { beforeAll, afterAll, expect } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import type { Response } from 'undici';
import { signRequest } from './setup.shared';
import http from 'node:http';
import * as ed from '@noble/ed25519';

let worker: Unstable_DevWorker;
let server: http.Server;
let serverPort: number;
const received: { method: string; url: string; body: any }[] = [];
const mirrorEvents: any[] = [];

beforeAll(async () => {
  // Start a local HTTP server to intercept Discord webhook edits
  await new Promise<void>((resolve) => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        let body: any = undefined;
        try { body = bodyStr ? JSON.parse(bodyStr) : undefined; } catch (e) {
          // Non-JSON bodies are acceptable in tests; store raw
          body = bodyStr;
        }
        received.push({ method: req.method || 'GET', url: req.url || '', body });
        // Handle mirror endpoints for follow-up verification
        if ((req.url || '').startsWith('/_test/mirror')) {
          if (req.method === 'POST') {
            mirrorEvents.push(body);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          if (req.method === 'GET') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ events: mirrorEvents.slice() }));
            return;
          }
        }
        // Default response
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr && 'port' in addr) {
        serverPort = addr.port as number;
      }
      resolve();
    });
  });

  // Compute public key matching test signing key
  const privateKeyHex = process.env.SIGNATURE_PRIVATE_KEY || 'bfbb3f0da095ff411191941cf30bc7a4afaa2a223b78ad05a049751b265f5049';
  const privateKey = Uint8Array.from(Buffer.from(privateKeyHex, 'hex'));
  const pubKeyBytes = await ed.getPublicKeyAsync(privateKey);
  const publicKeyHex = Buffer.from(pubKeyBytes).toString('hex');

  worker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    env: 'dev',
    logLevel: 'log',
    local: true,
    compatibilityFlags: [],
    vars: {
      DISCORD_API_BASE: `http://127.0.0.1:${serverPort}`,
  SIGNATURE_PUBLIC_KEY: publicKeyHex,
  DISCORD_APPLICATION_ID: 'test-app',
  DISCORD_TOKEN: 'test-token',
  REDDIT_APPLICATION_ID: 'test-reddit-app',
  REDDIT_TOKEN: 'test-reddit-secret',
  ENABLE_TEST_MIRROR: 'true',
  FOLLOWUP_MIRROR_URL: `http://127.0.0.1:${serverPort}/_test/mirror`,
  DRY_RUN_FOLLOWUPS: 'true',
    }
  });
});

afterAll(async () => {
  await worker.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return await worker.fetch('/', request);
}

export { signAndSendRequest };

export function popIntercepts() {
  const copy = received.slice();
  received.length = 0;
  return copy;
}

export function getIntercepts() {
  return received.slice();
}

export async function waitForIntercept(predicate: (calls: { method: string; url: string; body: any }[]) => boolean, timeoutMs = 7000, intervalMs = 150): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate(getIntercepts())) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  expect(false, 'Timed out waiting for intercept match').toBe(true);
}

export async function getFollowupEvents(): Promise<any[]> {
  const res = await fetch(`http://127.0.0.1:${serverPort}/_test/mirror`);
  const json = await res.json() as any;
  return (json.events as any[]) ?? [];
}

export async function waitForFollowup(predicate: (events: any[]) => boolean, timeoutMs = 7000, intervalMs = 150): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const events = await getFollowupEvents();
    if (predicate(events)) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  expect(false, 'Timed out waiting for followup events').toBe(true);
}
