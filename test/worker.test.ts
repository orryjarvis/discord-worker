import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ed from '@noble/ed25519';
import {
  ApplicationCommandOptionType,
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v10';
import worker from '../src/index.js';

// Test key pair - matches test/e2e/setup.shared.ts defaults
const TEST_PRIVATE_KEY = 'd46b224eca160429fbbd3c903994bb93da0532635839530a1fd6cdac1bd4023e';
const TEST_PUBLIC_KEY = '04762816e9bab4e08bfcce909351a221ca8f7751affa16ef757881eba6560d1e';

const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
const mockAI = { run: vi.fn() };
const mockKv = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
};

const TEST_ENV = {
  AI: mockAI,
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
  mockAI.run.mockClear();
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

  it('responds to /pastify command with modal response (type 9)', async () => {
    const req = await signedRequest({
      id: 'cmd-1',
      type: InteractionType.ApplicationCommand,
      token: 'tok',
      data: { name: 'pastify' },
    });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toMatchObject({
      type: InteractionResponseType.Modal,
      data: {
        custom_id: 'pastify_modal',
        title: 'Pastify Idea',
      },
    });
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('defers publicly and enqueues insult generation for the selected user', async () => {
    const req = await signedRequest({
      id: 'cmd-insult-1',
      type: InteractionType.ApplicationCommand,
      token: 'insult-token',
      data: {
        name: 'insult',
        options: [
          {
            name: 'target',
            type: ApplicationCommandOptionType.User,
            value: 'user-2',
          },
        ],
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    });
    expect(mockQueue.send).toHaveBeenCalledWith({
      token: 'insult-token',
      task: {
        commandName: 'insult',
        payload: {
          targetUserId: 'user-2',
        },
      },
    });
  });

  it('defers publicly and enqueues generation on modal submit', async () => {
    const req = await signedRequest({
      id: 'modal-123',
      type: InteractionType.ModalSubmit,
      token: 'modal-token',
      guild_id: 'guild-1',
      channel_id: 'channel-1',
      member: { user: { id: 'user-1' } },
      data: {
        custom_id: 'pastify_modal',
        components: [
          {
            components: [
              {
                custom_id: 'pastify_modal_text',
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
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    });
    expect(mockQueue.send).toHaveBeenCalledWith({
      token: 'modal-token',
      task: {
        commandName: 'pastify',
        payload: {
          idea: 'hello modal',
        },
      },
    });
    expect(mockKv.put).not.toHaveBeenCalled();
  });

  it('responds with 400 when modal text input is missing', async () => {
    const req = await signedRequest({
      id: 'modal-missing-text',
      type: InteractionType.ModalSubmit,
      token: 'tok',
      data: {
        custom_id: 'pastify_modal',
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
    mockAI.run.mockResolvedValue({ response: 'PASTIFIED CHAT ENERGY' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: '1',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: 'pastify',
            payload: {
              idea: 'streamer misses one minion',
            },
          },
        },
        ack,
        retry: vi.fn(),
      }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(mockAI.run).toHaveBeenCalledWith(
      '@cf/qwen/qwen3-30b-a3b-fp8',
      expect.objectContaining({
        messages: expect.any(Array),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: 'PASTIFIED CHAT ENERGY',
        }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });

  it('queue consumer posts fallback message when AI generation fails', async () => {
    mockAI.run.mockRejectedValue(new Error('model unavailable'));
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: '1',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: 'pastify',
            payload: {
              idea: 'some idea',
            },
          },
        },
        ack,
        retry: vi.fn(),
      }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Could not pastify that idea right now. Try again in a moment.',
        }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });

  it('queue consumer posts a light-hearted insult mentioning the selected user', async () => {
    mockAI.run.mockResolvedValue({ response: 'you fight minions like they owe you rent' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: 'insult-1',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: 'insult',
            payload: {
              targetUserId: 'user-42',
            },
          },
        },
        ack,
        retry: vi.fn(),
      }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(mockAI.run).toHaveBeenCalledWith(
      '@cf/qwen/qwen3-30b-a3b-fp8',
      expect.objectContaining({
        messages: expect.any(Array),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: '<@user-42> you fight minions like they owe you rent',
        }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });

  it('queue consumer posts insult fallback message when AI generation fails', async () => {
    mockAI.run.mockRejectedValue(new Error('model unavailable'));
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: 'insult-2',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: 'insult',
            payload: {
              targetUserId: 'user-42',
            },
          },
        },
        ack,
        retry: vi.fn(),
      }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: '<@user-42> I had a light-hearted roast ready, but the punchline got lost. Try again in a moment.',
        }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });

  it('extracts text from choices[].message.content response shape', async () => {
    mockAI.run.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'PASTA FROM CHOICES',
          },
        },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: '1',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: 'pastify',
            payload: {
              idea: 'clutch baron steal',
            },
          },
        },
        ack,
        retry: vi.fn(),
      }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'PASTA FROM CHOICES' }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });

  it('extracts text from output/content response shape', async () => {
    mockAI.run.mockResolvedValue({
      output: [
        {
          content: [
            { type: 'output_text', text: 'FIRST LINE' },
            { type: 'output_text', text: 'SECOND LINE' },
          ],
        },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: '1',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: 'pastify',
            payload: {
              idea: 'mid diff speech',
            },
          },
        },
        ack,
        retry: vi.fn(),
      }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'FIRST LINE\nSECOND LINE' }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });

  it('queue consumer does not call AI when follow-up task is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: '1',
        timestamp: new Date(),
        body: { token: 'interaction-token' },
        ack,
        retry: vi.fn(),
      }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(mockAI.run).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Could not process follow-up payload. Please try again.',
        }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });

  it('retries failed message and continues processing remaining queue messages', async () => {
    mockAI.run.mockResolvedValue({ response: 'SAFE OUTPUT' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const firstAck = vi.fn();
    const firstRetry = vi.fn();
    const secondAck = vi.fn();
    const secondRetry = vi.fn();

    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [
        {
          id: 'm1',
          timestamp: new Date(),
          body: {
            token: 'interaction-token-1',
            task: {
              commandName: 'unknown-command',
              payload: {},
            },
          },
          ack: firstAck,
          retry: firstRetry,
        },
        {
          id: 'm2',
          timestamp: new Date(),
          body: {
            token: 'interaction-token-2',
            task: {
              commandName: 'pastify',
              payload: {
                idea: 'still runs after first failure',
              },
            },
          },
          ack: secondAck,
          retry: secondRetry,
        },
      ],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(firstRetry).toHaveBeenCalled();
    expect(firstAck).not.toHaveBeenCalled();
    expect(secondAck).toHaveBeenCalled();
    expect(secondRetry).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

