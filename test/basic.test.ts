import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ed from '@noble/ed25519';
import worker from '../src/index.js';

// Test key pair - matches test/e2e/setup.shared.ts defaults
const TEST_PRIVATE_KEY = 'd46b224eca160429fbbd3c903994bb93da0532635839530a1fd6cdac1bd4023e';
const TEST_PUBLIC_KEY = '04762816e9bab4e08bfcce909351a221ca8f7751affa16ef757881eba6560d1e';

const TEST_ENV = {
  DISCORD_APPLICATION_ID: 'test-app-id',
  SIGNATURE_PUBLIC_KEY: TEST_PUBLIC_KEY,
  DISCORD_TOKEN: 'test-token',
};

async function signedRequest(body: object): Promise<Request> {
  const timestamp = Date.now().toString();
  const json = JSON.stringify(body);
  const message = new TextEncoder().encode(timestamp + json);
  const privateKey = Uint8Array.from(Buffer.from(TEST_PRIVATE_KEY, 'hex'));
  const signature = await ed.signAsync(message, privateKey);
  return new Request('http://localhost/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': Buffer.from(signature).toString('hex'),
      'x-signature-timestamp': timestamp,
    },
    body: json,
  });
}

function mockCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Discord Worker', () => {
  it('returns 405 for non-POST requests', async () => {
    const req = new Request('http://localhost/', { method: 'GET' });
    const res = await worker.fetch(req, TEST_ENV as any, mockCtx());
    expect(res.status).toBe(405);
  });

  it('returns 401 for missing signature headers', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ type: 1 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, TEST_ENV as any, mockCtx());
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid signature', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ type: 1 }),
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': 'deadbeef'.repeat(8),
        'x-signature-timestamp': Date.now().toString(),
      },
    });
    const res = await worker.fetch(req, TEST_ENV as any, mockCtx());
    expect(res.status).toBe(401);
  });

  it('responds to PING with PONG (type 1)', async () => {
    const req = await signedRequest({ type: 1 });
    const res = await worker.fetch(req, TEST_ENV as any, mockCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.type).toBe(1);
  });

  it('responds to /test command with deferred response (type 5)', async () => {
    const req = await signedRequest({ type: 2, token: 'tok', data: { name: 'test' } });
    const ctx = mockCtx();
    const res = await worker.fetch(req, TEST_ENV as any, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.type).toBe(5);
    expect(ctx.waitUntil).toHaveBeenCalledOnce();
  });

  it('responds to unknown command with 400', async () => {
    const req = await signedRequest({ type: 2, token: 'tok', data: { name: 'notacommand' } });
    const res = await worker.fetch(req, TEST_ENV as any, mockCtx());
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/Unknown Command/);
  });

  it('background task calls edit-original-response endpoint after 5 seconds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const req = await signedRequest({ type: 2, token: 'interaction-token', data: { name: 'test' } });
    const ctx = mockCtx();
    const res = await worker.fetch(req, TEST_ENV as any, ctx);
    expect(res.status).toBe(200);

    const [bgPromise] = (ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls[0];
    await vi.advanceTimersByTimeAsync(5000);
    await bgPromise;

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'Hello World' }),
      }),
    );
  });
});

