import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ed from '@noble/ed25519';
import {
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from 'discord-api-types/v10';
import worker from '../src/index.js';

// Test key pair - matches test/e2e/setup.shared.ts defaults
const TEST_PRIVATE_KEY = 'd46b224eca160429fbbd3c903994bb93da0532635839530a1fd6cdac1bd4023e';
const TEST_PUBLIC_KEY = '04762816e9bab4e08bfcce909351a221ca8f7751affa16ef757881eba6560d1e';

const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
const mockKv = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
};

const TEST_ENV = {
  DISCORD_APPLICATION_ID: 'test-app-id',
  SIGNATURE_PUBLIC_KEY: TEST_PUBLIC_KEY,
  DISCORD_TOKEN: 'test-token',
  DISCORD_API_BASE_URL: 'https://discord.com/api/v10',
  FOLLOW_UP_QUEUE: mockQueue,
  KV: mockKv,
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

afterEach(() => {
  vi.unstubAllGlobals();
  mockQueue.send.mockClear();
  mockKv.put.mockClear();
  mockKv.get.mockClear();
  mockKv.delete.mockClear();
});

describe('Discord Worker', () => {
  it('returns 405 for non-POST requests', async () => {
    const req = new Request('http://localhost/', { method: 'GET' });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(405);
  });

  it('returns 401 for missing signature headers', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ type: InteractionType.Ping }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid signature', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ type: InteractionType.Ping }),
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': 'deadbeef'.repeat(8),
        'x-signature-timestamp': Date.now().toString(),
      },
    });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(401);
  });

  it('responds to PING with PONG (type 1)', async () => {
    const req = await signedRequest({ type: InteractionType.Ping });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.type).toBe(InteractionResponseType.Pong);
  });

  it('responds to /test command with deferred response (type 5) and enqueues follow-up', async () => {
    const req = await signedRequest({
      id: 'cmd-1',
      type: InteractionType.ApplicationCommand,
      token: 'tok',
      data: { name: 'test' },
    });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.type).toBe(InteractionResponseType.DeferredChannelMessageWithSource);
    expect(mockQueue.send).toHaveBeenCalledWith({ token: 'tok' });
  });

  it('responds to button component interaction with a modal response (type 9)', async () => {
    const req = await signedRequest({
      id: 'cmp-1',
      type: InteractionType.MessageComponent,
      token: 'tok',
      data: { custom_id: 'test_open_modal' },
    });

    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toMatchObject({
      type: InteractionResponseType.Modal,
      data: {
        custom_id: 'test_modal',
        title: 'Submit Text',
      },
    });
  });

  it('stores modal submission data in KV and returns ephemeral confirmation', async () => {
    const req = await signedRequest({
      id: 'modal-123',
      type: InteractionType.ModalSubmit,
      token: 'tok',
      guild_id: 'guild-1',
      channel_id: 'channel-1',
      member: { user: { id: 'user-1' } },
      data: {
        custom_id: 'test_modal',
        components: [
          {
            components: [
              {
                custom_id: 'test_modal_text',
                value: 'hello modal',
              },
            ],
          },
        ],
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'Submission saved.',
        flags: MessageFlags.Ephemeral,
      },
    });
    expect(mockKv.put).toHaveBeenCalledTimes(1);
    const [key, value] = mockKv.put.mock.calls[0] as [string, string];
    expect(key).toBe('modal-123');
    expect(JSON.parse(value)).toMatchObject({
      interactionId: 'modal-123',
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      customId: 'test_modal',
      text: 'hello modal',
    });
  });

  it('responds with 400 when modal text input is missing', async () => {
    const req = await signedRequest({
      id: 'modal-missing-text',
      type: InteractionType.ModalSubmit,
      token: 'tok',
      data: {
        custom_id: 'test_modal',
        components: [
          {
            components: [
              {
                custom_id: 'not_the_text_input',
                value: 'ignored',
              },
            ],
          },
        ],
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/Missing Modal Text/);
    expect(mockKv.put).not.toHaveBeenCalled();
  });

  it('responds to unknown command with 400', async () => {
    const req = await signedRequest({
      id: 'cmd-2',
      type: InteractionType.ApplicationCommand,
      token: 'tok',
      data: { name: 'notacommand' },
    });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/Unknown Command/);
  });

  it('responds to unknown interaction type with 400', async () => {
    const req = await signedRequest({
      id: 'unknown-1',
      type: 999,
      token: 'tok',
    });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/Unknown Interaction Type/);
  });

  it('queue consumer calls edit-original-response endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{ id: '1', timestamp: new Date(), body: { token: 'interaction-token' }, ack, retry: vi.fn() }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Click to open the form.',
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  custom_id: 'test_open_modal',
                  label: 'Open form',
                  style: ButtonStyle.Primary,
                },
              ],
            },
          ],
        }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });
});

