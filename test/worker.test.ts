import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ed from '@noble/ed25519';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v10';
import worker from '@/index';

// Test key pair - matches test/e2e/setup.shared.ts defaults
const TEST_PRIVATE_KEY = 'd46b224eca160429fbbd3c903994bb93da0532635839530a1fd6cdac1bd4023e';
const TEST_PUBLIC_KEY = '04762816e9bab4e08bfcce909351a221ca8f7751affa16ef757881eba6560d1e';
const { privateKey: TEST_GITHUB_PRIVATE_KEY } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
const mockAI = { run: vi.fn() };
const mockReminderStub = { fetch: vi.fn().mockResolvedValue(new Response(null, { status: 204 })) };
const mockReminderNamespace = {
  idFromName: vi.fn().mockReturnValue({ toString: () => 'reminder-id' }),
  get: vi.fn().mockReturnValue(mockReminderStub),
};
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
  WORD_OF_DAY_CHANNEL_ID: 'word-channel-1',
  WORD_OF_DAY_FEED_URL: 'https://example.com/wotd.xml',
  DISCORD_API_BASE_URL: 'https://discord.com/api/v10',
  GITHUB_APP_ID: '123456',
  GITHUB_APP_INSTALLATION_ID: '987654',
  GITHUB_APP_PRIVATE_KEY: TEST_GITHUB_PRIVATE_KEY,
  GITHUB_ISSUE_REPOSITORY: 'oaj/discord-worker',
  GITHUB_API_BASE_URL: 'https://api.github.com',
  GITHUB_WEBHOOK_SECRET: 'github-test-secret',
  GITHUB_DEPLOY_WORKFLOW_PATH: '.github/workflows/prod.yaml',
  FOLLOW_UP_QUEUE: mockQueue,
  REMINDER_SCHEDULER: mockReminderNamespace,
  KV: mockKv,
};

const SAMPLE_WOTD_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:merriam="https://www.merriam-webster.com/word-of-the-day" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
  <channel>
    <item>
      <title><![CDATA[ fraught ]]></title>
      <link><![CDATA[ https://www.merriam-webster.com/word-of-the-day/fraught-2026-05-22 ]]></link>
      <description><![CDATA[<p><strong>fraught</strong> &#149; \\FRAWT\\ &#149; <em>adjective</em></p>]]></description>
      <itunes:summary><![CDATA[ Merriam-Webster's Word of the Day for May 22, 2026 is: fraught \\FRAWT\\ adjective ]]></itunes:summary>
      <merriam:shortdef><![CDATA[ causing or involving a lot of emotional stress or worry ]]></merriam:shortdef>
    </item>
  </channel>
</rss>`;

async function signedRequest(body: object): Promise<Request> {
  const timestamp = Date.now().toString();
  const json = JSON.stringify(body);
  const message = new TextEncoder().encode(timestamp + json);
  const privateKey = Uint8Array.from(Buffer.from(TEST_PRIVATE_KEY, 'hex'));
  const signature = await ed.signAsync(message, privateKey);
  return new Request('http://localhost/discord', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': Buffer.from(signature).toString('hex'),
      'x-signature-timestamp': timestamp,
    },
    body: json,
  });
}

function signedGitHubWebhookRequest(
  body: object,
  {
    event = 'workflow_run',
    deliveryId = `delivery-${Date.now()}`,
    secret = TEST_ENV.GITHUB_WEBHOOK_SECRET,
  }: {
    event?: string;
    deliveryId?: string;
    secret?: string;
  } = {},
): Request {
  const json = JSON.stringify(body);
  const signature = createHmac('sha256', secret).update(json).digest('hex');
  return new Request('http://localhost/github', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${signature}`,
      'x-github-event': event,
      'x-github-delivery': deliveryId,
    },
    body: json,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mockQueue.send.mockClear();
  mockAI.run.mockClear();
  mockReminderStub.fetch.mockClear();
  mockReminderNamespace.idFromName.mockClear();
  mockReminderNamespace.get.mockClear();
  mockKv.put.mockClear();
  mockKv.get.mockClear();
  mockKv.delete.mockClear();
});

describe('Discord Worker', () => {
  it('returns 404 for non-discord paths', async () => {
    const req = new Request('http://localhost/', { method: 'GET' });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(404);
  });

  it('returns 405 for non-POST requests on /discord', async () => {
    const req = new Request('http://localhost/discord', { method: 'GET' });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(405);
  });

  it('returns 405 for non-POST requests on /github', async () => {
    const req = new Request('http://localhost/github', { method: 'GET' });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(405);
  });

  it('returns 401 for missing signature headers', async () => {
    const req = new Request('http://localhost/discord', {
      method: 'POST',
      body: JSON.stringify({ type: InteractionType.Ping }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid signature', async () => {
    const req = new Request('http://localhost/discord', {
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

  it('returns 401 for invalid github webhook signature', async () => {
    const req = signedGitHubWebhookRequest({
      action: 'completed',
      repository: { full_name: 'oaj/discord-worker' },
      workflow_run: {
        id: 1001,
        name: 'prod',
        path: '.github/workflows/prod.yaml',
      },
    }, {
      secret: 'wrong-secret',
    });

    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(401);
  });

  it('ignores github webhook events that are not workflow_run', async () => {
    const req = signedGitHubWebhookRequest({ action: 'published' }, { event: 'release' });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(202);
  });

  it('ignores completed workflow_run events for other workflow files', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = signedGitHubWebhookRequest({
      action: 'completed',
      repository: { full_name: 'oaj/discord-worker' },
      workflow_run: {
        id: 1002,
        name: 'ci',
        path: '.github/workflows/ci.yaml',
        status: 'completed',
        conclusion: 'success',
        html_url: 'https://github.com/oaj/discord-worker/actions/runs/1002',
        head_branch: 'main',
        event: 'push',
        actor: { login: 'github-actions[bot]' },
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockKv.put).not.toHaveBeenCalled();
  });

  it('posts workflow_run completion status to Discord channel for configured deploy workflow', async () => {
    mockKv.get.mockResolvedValueOnce(null);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"msg-1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const req = signedGitHubWebhookRequest({
      action: 'completed',
      repository: { full_name: 'oaj/discord-worker' },
      workflow_run: {
        id: 1003,
        name: 'prod',
        path: '.github/workflows/prod.yaml',
        status: 'completed',
        conclusion: 'success',
        html_url: 'https://github.com/oaj/discord-worker/actions/runs/1003',
        head_branch: 'main',
        event: 'workflow_dispatch',
        actor: { login: 'release-bot' },
      },
    }, {
      deliveryId: 'delivery-success-1003',
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/word-channel-1/messages',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(typeof requestInit.body).toBe('string');
    const postedBody = JSON.parse(requestInit.body as string) as { content: string };
    expect(postedBody.content).toContain('GitHub deploy status: SUCCESS');
    expect(postedBody.content).toContain('workflow: prod (.github/workflows/prod.yaml)');
    expect(postedBody.content).toContain('run: https://github.com/oaj/discord-worker/actions/runs/1003');

    expect(mockKv.put).toHaveBeenCalledWith(
      'github-delivery:delivery-success-1003',
      expect.any(String),
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
  });

  it('does not post duplicate github deliveries when delivery id was already processed', async () => {
    mockKv.get.mockResolvedValueOnce('{"processedAt":"2026-06-02T10:10:00.000Z"}');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = signedGitHubWebhookRequest({
      action: 'completed',
      repository: { full_name: 'oaj/discord-worker' },
      workflow_run: {
        id: 1004,
        name: 'prod',
        path: '.github/workflows/prod.yaml',
      },
    }, {
      deliveryId: 'delivery-duplicate-1004',
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockKv.put).not.toHaveBeenCalled();
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

  it('responds to /issue command with a multi-field modal response', async () => {
    const req = await signedRequest({
      id: 'cmd-issue-1',
      type: InteractionType.ApplicationCommand,
      token: 'issue-token',
      data: { name: 'issue' },
    });
    const res = await worker.fetch(req, TEST_ENV as any);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toMatchObject({
      type: InteractionResponseType.Modal,
      data: {
        custom_id: 'issue_modal',
        title: 'Log GitHub Issue',
      },
    });
    expect(Array.isArray(json.data.components)).toBe(true);
    expect(json.data.components).toHaveLength(2);
    expect(json.data.components[0].components[0]).toMatchObject({
      custom_id: 'issue_title',
    });
    expect(json.data.components[1].components[0]).toMatchObject({
      custom_id: 'issue_body',
    });
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('enqueues GitHub issue creation after /issue modal submit', async () => {
    const req = await signedRequest({
      id: 'cmd-issue-modal-1',
      type: InteractionType.ModalSubmit,
      token: 'issue-modal-token',
      data: {
        custom_id: 'issue_modal',
        components: [
          {
            components: [
              {
                custom_id: 'issue_title',
                value: 'Bug report',
              },
            ],
          },
          {
            components: [
              {
                custom_id: 'issue_body',
                value: 'The widget freezes when the queue is empty.',
              },
            ],
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
      token: 'issue-modal-token',
      task: {
        commandName: 'issue',
        payload: {
          title: 'Bug report',
          body: 'The widget freezes when the queue is empty.',
        },
      },
    });
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

  it('acknowledges /wotd immediately and enqueues background posting task', async () => {
    const req = await signedRequest({
      id: 'cmd-wotd-1',
      type: InteractionType.ApplicationCommand,
      token: 'wotd-token',
      data: {
        name: 'wotd',
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'wotd queued',
        flags: 0,
      },
    });
    expect(mockQueue.send).toHaveBeenCalledWith({
      task: {
        commandName: 'wotd',
        payload: {},
      },
    });
  });

  it('responds to /shiny immediately with a channel-visible roll and no queue enqueue', async () => {
    const randomSpy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((typedArray) => {
      const sample = typedArray as Uint16Array;
      sample[0] = 1234;
      return typedArray;
    });

    const req = await signedRequest({
      id: 'cmd-shiny-1',
      type: InteractionType.ApplicationCommand,
      token: 'shiny-token',
      data: {
        name: 'shiny',
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'You rolled 1235/8192.',
        flags: 0,
      },
    });
    expect(mockQueue.send).not.toHaveBeenCalled();
    expect(randomSpy).toHaveBeenCalled();
  });

  it('uses uniformly mapped lower bound for /shiny when random sample is 0', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((typedArray) => {
      const sample = typedArray as Uint16Array;
      sample[0] = 0;
      return typedArray;
    });

    const req = await signedRequest({
      id: 'cmd-shiny-lower-1',
      type: InteractionType.ApplicationCommand,
      token: 'shiny-lower-token',
      data: {
        name: 'shiny',
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'You rolled 1/8192.',
        flags: 0,
      },
    });
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('uses uniformly mapped upper bound and shiny fanfare when random sample maps to 8192', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((typedArray) => {
      const sample = typedArray as Uint16Array;
      sample[0] = 8191;
      return typedArray;
    });

    const req = await signedRequest({
      id: 'cmd-shiny-upper-1',
      type: InteractionType.ApplicationCommand,
      token: 'shiny-upper-token',
      data: {
        name: 'shiny',
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'You rolled 8192/8192. ✨ SHINY ENCOUNTER! ✨',
        flags: 0,
      },
    });
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('maps full Uint16 domain uniformly for /shiny without retries', async () => {
    const randomSpy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((typedArray) => {
      const sample = typedArray as Uint16Array;
      sample[0] = 65535;
      return typedArray;
    });

    const req = await signedRequest({
      id: 'cmd-shiny-reject-1',
      type: InteractionType.ApplicationCommand,
      token: 'shiny-reject-token',
      data: {
        name: 'shiny',
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'You rolled 8192/8192. ✨ SHINY ENCOUNTER! ✨',
        flags: 0,
      },
    });
    expect(randomSpy).toHaveBeenCalled();
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('does not rely on Math.random for /shiny', async () => {
    const mathRandomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random should not be used by /shiny');
    });
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((typedArray) => {
      const sample = typedArray as Uint16Array;
      sample[0] = 42;
      return typedArray;
    });

    const req = await signedRequest({
      id: 'cmd-shiny-no-math-random-1',
      type: InteractionType.ApplicationCommand,
      token: 'shiny-no-math-random-token',
      data: {
        name: 'shiny',
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'You rolled 43/8192.',
        flags: 0,
      },
    });
    expect(mathRandomSpy).not.toHaveBeenCalled();
  });

  it('acknowledges /reminder immediately and schedules reminder via durable object alarm', async () => {
    const req = await signedRequest({
      id: 'cmd-reminder-1',
      type: InteractionType.ApplicationCommand,
      token: 'reminder-token',
      channel_id: 'channel-7',
      member: {
        user: {
          id: 'user-7',
        },
      },
      data: {
        name: 'reminder',
        options: [
          {
            name: 'length',
            type: ApplicationCommandOptionType.Integer,
            value: 3,
          },
          {
            name: 'interval',
            type: ApplicationCommandOptionType.String,
            value: 'hours',
          },
          {
            name: 'note',
            type: ApplicationCommandOptionType.String,
            value: 'switch the laundry',
          },
        ],
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'Reminder set for 3 hours.',
        flags: MessageFlags.Ephemeral,
      },
    });
    expect(mockQueue.send).not.toHaveBeenCalled();
    expect(mockReminderNamespace.idFromName).toHaveBeenCalledTimes(1);
    expect(mockReminderNamespace.get).toHaveBeenCalledTimes(1);
    expect(mockReminderStub.fetch).toHaveBeenCalledWith(
      'https://reminder.internal/schedule',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const requestInit = mockReminderStub.fetch.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit).toBeTruthy();
    expect(typeof requestInit.body).toBe('string');
    const scheduleBody = JSON.parse(requestInit.body as string) as {
      reminderId: string;
      scheduledFor: number;
      task: {
        commandName: string;
        payload: {
          channelId: string;
          userId: string;
          length: number;
          interval: string;
          note: string;
        };
      };
    };

    expect(scheduleBody.reminderId).toBeTypeOf('string');
    expect(scheduleBody.scheduledFor).toBeGreaterThan(Date.now());
    expect(scheduleBody.task).toEqual({
      commandName: 'reminder',
      payload: {
        channelId: 'channel-7',
        userId: 'user-7',
        length: 3,
        interval: 'hours',
        note: 'switch the laundry',
      },
    });
  });

  it('accepts long /reminder lengths without interval caps', async () => {
    const req = await signedRequest({
      id: 'cmd-reminder-2',
      type: InteractionType.ApplicationCommand,
      token: 'reminder-token-2',
      channel_id: 'channel-7',
      member: {
        user: {
          id: 'user-7',
        },
      },
      data: {
        name: 'reminder',
        options: [
          {
            name: 'interval',
            type: ApplicationCommandOptionType.String,
            value: 'days',
          },
          {
            name: 'length',
            type: ApplicationCommandOptionType.Integer,
            value: 365,
          },
          {
            name: 'note',
            type: ApplicationCommandOptionType.String,
            value: 'renew domain certs',
          },
        ],
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'Reminder set for 365 days.',
        flags: MessageFlags.Ephemeral,
      },
    });
    expect(mockQueue.send).not.toHaveBeenCalled();
    expect(mockReminderStub.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects /reminder when note is missing', async () => {
    const req = await signedRequest({
      id: 'cmd-reminder-3',
      type: InteractionType.ApplicationCommand,
      token: 'reminder-token-3',
      channel_id: 'channel-7',
      member: {
        user: {
          id: 'user-7',
        },
      },
      data: {
        name: 'reminder',
        options: [
          {
            name: 'interval',
            type: ApplicationCommandOptionType.String,
            value: 'days',
          },
          {
            name: 'length',
            type: ApplicationCommandOptionType.Integer,
            value: 2,
          },
        ],
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'Usage: /reminder length:<number> interval:<minutes|hours|days> note:<text>',
        flags: MessageFlags.Ephemeral,
      },
    });
    expect(mockQueue.send).not.toHaveBeenCalled();
    expect(mockReminderStub.fetch).not.toHaveBeenCalled();
  });

  it('defers publicly and enqueues insult generation for user context command target', async () => {
    const req = await signedRequest({
      id: 'cmd-insult-context-1',
      type: InteractionType.ApplicationCommand,
      token: 'insult-context-token',
      data: {
        name: 'insult',
        type: ApplicationCommandType.User,
        target_id: 'user-context-2',
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    });
    expect(mockQueue.send).toHaveBeenCalledWith({
      token: 'insult-context-token',
      task: {
        commandName: 'insult',
        payload: {
          targetUserId: 'user-context-2',
        },
      },
    });
  });

  it('defers publicly and enqueues 8ball generation for message context command target', async () => {
    const req = await signedRequest({
      id: 'cmd-8ball-context-1',
      type: InteractionType.ApplicationCommand,
      token: '8ball-context-token',
      data: {
        name: '8ball',
        type: ApplicationCommandType.Message,
        target_id: 'message-ctx-1',
        resolved: {
          messages: {
            'message-ctx-1': {
              content: 'Should I queue one more ranked game?',
              author: {
                id: 'message-author-1',
              },
            },
          },
        },
      },
    });

    const res = await worker.fetch(req, TEST_ENV as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    });
    expect(mockQueue.send).toHaveBeenCalledWith({
      token: '8ball-context-token',
      task: {
        commandName: '8ball',
        payload: {
          targetMessageId: 'message-ctx-1',
          targetMessageContent: 'Should I queue one more ranked game?',
          targetMessageAuthorId: 'message-author-1',
        },
      },
    });
  });

  it('preserves numeric slash command option values instead of dropping them', async () => {
    const req = await signedRequest({
      id: 'cmd-insult-2',
      type: InteractionType.ApplicationCommand,
      token: 'insult-token-2',
      data: {
        name: 'insult',
        options: [
          {
            name: 'target',
            type: ApplicationCommandOptionType.User,
            value: 42,
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
      token: 'insult-token-2',
      task: {
        commandName: 'insult',
        payload: {
          targetUserId: 42,
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
    expect(await res.text()).toMatch(/Missing required modal fields\./);
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

  it('scheduled handler posts word-of-day to configured channel at 7:30 ET', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(SAMPLE_WOTD_FEED, { status: 200 }))
      .mockResolvedValueOnce(new Response('{"id":"message-1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    let scheduledPromise: Promise<unknown> | null = null;
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => {
        scheduledPromise = promise;
      },
    };

    worker.scheduled({
      cron: '30 11 * * *',
      scheduledTime: Date.parse('2026-05-22T11:30:00.000Z'),
    } as any, TEST_ENV as any, ctx as any);

    if (!scheduledPromise) {
      throw new Error('scheduled promise was not registered via waitUntil');
    }
    await Promise.resolve(scheduledPromise);

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://example.com/wotd.xml');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://discord.com/api/v10/channels/word-channel-1/messages',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(mockKv.put).toHaveBeenCalledWith(
      'word-of-day:posted:2026-05-22',
      expect.any(String),
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
  });

  it('scheduled handler skips when local ET time is not 7:30', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    let scheduledPromise: Promise<unknown> | null = null;
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => {
        scheduledPromise = promise;
      },
    };

    worker.scheduled({
      cron: '30 12 * * *',
      scheduledTime: Date.parse('2026-05-22T12:31:00.000Z'),
    } as any, TEST_ENV as any, ctx as any);

    if (!scheduledPromise) {
      throw new Error('scheduled promise was not registered via waitUntil');
    }
    await Promise.resolve(scheduledPromise);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockKv.put).not.toHaveBeenCalled();
  });

  it('scheduled handler skips duplicate local-date posts', async () => {
    mockKv.get.mockResolvedValueOnce('{"postedAt":"2026-05-22T11:30:01.000Z"}');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    let scheduledPromise: Promise<unknown> | null = null;
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => {
        scheduledPromise = promise;
      },
    };

    worker.scheduled({
      cron: '30 11 * * *',
      scheduledTime: Date.parse('2026-05-22T11:30:00.000Z'),
    } as any, TEST_ENV as any, ctx as any);

    if (!scheduledPromise) {
      throw new Error('scheduled promise was not registered via waitUntil');
    }
    await Promise.resolve(scheduledPromise);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockKv.put).not.toHaveBeenCalled();
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

  it('queue consumer creates a GitHub issue and edits the original response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'github-installation-token' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ html_url: 'https://github.com/oaj/discord-worker/issues/42', number: 42 }), { status: 201 }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: 'issue-queue-1',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: 'issue',
            payload: {
              title: 'Bug report',
              body: 'The widget freezes when the queue is empty.',
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

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/app/installations/987654/access_tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('discord-worker'),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/oaj/discord-worker/issues',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('discord-worker'),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Created GitHub issue #42: https://github.com/oaj/discord-worker/issues/42',
        }),
      }),
    );
    expect(ack).toHaveBeenCalled();
  });

  it('queue consumer posts word-of-day using channel message endpoint for wotd tasks', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(SAMPLE_WOTD_FEED, { status: 200 }))
      .mockResolvedValueOnce(new Response('{"id":"message-1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: 'wotd-1',
        timestamp: new Date(),
        body: {
          task: {
            commandName: 'wotd',
            payload: {},
          },
        },
        ack,
        retry: vi.fn(),
      }],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch as any, TEST_ENV as any);

    expect(mockAI.run).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://example.com/wotd.xml');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://discord.com/api/v10/channels/word-channel-1/messages',
      expect.objectContaining({
        method: 'POST',
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

  it('queue consumer posts an 8ball quoted follow-up via original response edit', async () => {
    mockAI.run.mockResolvedValue({ response: 'Outlook says no, but your chaos energy says yes.' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: '8ball-1',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: '8ball',
            payload: {
              targetMessageId: 'message-1',
              targetMessageContent: 'Should we full send this?',
              targetMessageAuthorId: 'user-8ball-1',
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
          content: '> Should we full send this? - <@user-8ball-1>\n\n🎱 Outlook says no, but your chaos energy says yes.',
          allowed_mentions: {
            parse: [],
          },
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalled();
  });

  it('queue consumer uses quoted 8ball edit even when target message is present', async () => {
    mockAI.run.mockResolvedValue({ response: 'Reply hazy, ask after your coffee.' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: '8ball-fallback-1',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: '8ball',
            payload: {
              targetMessageId: 'message-1',
              targetMessageContent: 'Will this queue pop before sunrise?',
              targetMessageAuthorId: 'user-8ball-1',
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
          content: '> Will this queue pop before sunrise? - <@user-8ball-1>\n\n🎱 Reply hazy, ask after your coffee.',
          allowed_mentions: {
            parse: [],
          },
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalled();
  });

  it('queue consumer posts 8ball fallback message when message payload is missing text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ack = vi.fn();
    const batch = {
      queue: 'discord-follow-up-queue',
      messages: [{
        id: '8ball-2',
        timestamp: new Date(),
        body: {
          token: 'interaction-token',
          task: {
            commandName: '8ball',
            payload: {
              targetMessageId: 'message-1',
              targetMessageAuthorId: 'user-8ball-1',
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

    expect(mockAI.run).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/test-app-id/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: 'The magic 8-ball needs a message with text to read. Try again on a text message.',
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
