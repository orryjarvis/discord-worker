import { describe, it, expect } from 'vitest';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v10';
import {
  clearChannelPost,
  runScheduled,
  signAndSendRequest,
  waitForChannelPost,
  waitForFollowUp,
} from './setup';

describe('Discord Worker', () => {
  it('responds to Discord Ping interaction', async () => {
    const body = { type: InteractionType.Ping };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(InteractionResponseType.Pong);
  });

  it('responds to /pastify command with modal response (type 9)', async () => {
    const body = {
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token: `test-token-${Date.now()}`,
      data: { name: 'pastify' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect(await res.json() as any).toMatchObject({
      type: InteractionResponseType.Modal,
      data: {
        custom_id: 'pastify_modal',
      },
    });
  });

  it('runs the scheduled word-of-day activity via scheduled handler trigger', async () => {
    const scheduledTime = Date.parse('2026-05-22T11:30:00.000Z');
    const channelId = 'test-word-of-day-channel';
    const triggerStartedAt = Date.now();

    await clearChannelPost(channelId);

    const res = await runScheduled('30 11 * * *', scheduledTime);
    expect(res.status).toBe(200);

    const posted = await waitForChannelPost(channelId);
    expect(Date.parse(posted.receivedAt as string)).toBeGreaterThanOrEqual(triggerStartedAt);
    const payload = JSON.parse(posted.body) as Record<string, unknown>;

    expect(typeof payload.content).toBe('string');
    expect((payload.content as string)).toContain('Word of the Day');
    expect((payload.content as string)).toContain('https://www.merriam-webster.com/word-of-the-day/');
    expect((payload.content as string)).not.toContain('<');
  });

  it('acknowledges /wotd immediately and posts word-of-day to the configured channel', async () => {
    const channelId = 'test-word-of-day-channel';
    const token = `test-token-wotd-${Date.now()}`;
    const triggerStartedAt = Date.now();

    await clearChannelPost(channelId);

    const res = await signAndSendRequest({
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token,
      data: {
        name: 'wotd',
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json() as any).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'wotd queued',
        flags: 0,
      },
    });

    const posted = await waitForChannelPost(channelId);
    expect(Date.parse(posted.receivedAt as string)).toBeGreaterThanOrEqual(triggerStartedAt);
    const payload = JSON.parse(posted.body) as Record<string, unknown>;

    expect(typeof payload.content).toBe('string');
    expect((payload.content as string)).toContain('Word of the Day');
    expect((payload.content as string)).toContain('https://www.merriam-webster.com/word-of-the-day/');
    expect((payload.content as string)).not.toContain('<');
  });

  it('defers /insult and then sends a channel-visible roast mentioning the selected user', async () => {
    const correlationId = `insult-${Date.now()}`;
    const token = `test-token-${correlationId}`;

    const res = await signAndSendRequest({
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token,
      data: {
        name: 'insult',
        options: [
          {
            name: 'target',
            type: ApplicationCommandOptionType.User,
            value: 'user-e2e',
          },
        ],
      },
    });

    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(InteractionResponseType.DeferredChannelMessageWithSource);

    const followUp = await waitForFollowUp(correlationId);
    const patched = JSON.parse(followUp.body) as Record<string, unknown>;
    expect(typeof patched.content).toBe('string');
    expect(patched.content).toContain('<@user-e2e>');
    expect((patched.content as string).length).toBeGreaterThan('<@user-e2e> '.length);
  });

  it('defers user-context insult publicly and sends a roast mentioning the selected user', async () => {
    const correlationId = `insult-context-${Date.now()}`;
    const token = `test-token-${correlationId}`;

    const res = await signAndSendRequest({
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token,
      data: {
        name: 'insult',
        type: ApplicationCommandType.User,
        target_id: 'user-context-e2e',
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json() as any).toEqual({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    });

    const followUp = await waitForFollowUp(correlationId);
    const patched = JSON.parse(followUp.body) as Record<string, unknown>;
    expect(typeof patched.content).toBe('string');
    expect(patched.content).toContain('<@user-context-e2e>');
    expect((patched.content as string).length).toBeGreaterThan('<@user-context-e2e> '.length);
  });

  it('defers message-context 8ball publicly and sends a quoted follow-up via original response edit', async () => {
    const correlationId = `8ball-context-${Date.now()}`;
    const token = `test-token-${correlationId}`;

    const res = await signAndSendRequest({
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token,
      data: {
        name: '8ball',
        type: ApplicationCommandType.Message,
        target_id: 'message-context-e2e',
        resolved: {
          messages: {
            'message-context-e2e': {
              content: 'Should we run one more game before bed?',
              author: {
                id: 'message-author-e2e',
              },
            },
          },
        },
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json() as any).toEqual({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    });

    const followUp = await waitForFollowUp(correlationId);
    const payload = JSON.parse(followUp.body) as Record<string, unknown>;
    expect(followUp.method).toBe('PATCH');
    expect(typeof payload.content).toBe('string');
    expect((payload.content as string).length).toBeGreaterThan(0);

    expect((payload.content as string)).toContain('> Should we run one more game before bed?');
    expect((payload.content as string)).toContain('🎱 ');
  });

  it('defers on modal submit and then sends channel-visible pastified content', async () => {
    const correlationId = `followup-${Date.now()}`;
    const token = `test-token-${correlationId}`;

    const submitRes = await signAndSendRequest({
      id: `modal-${Date.now()}`,
      type: InteractionType.ModalSubmit,
      token,
      guild_id: 'guild-e2e',
      channel_id: 'channel-e2e',
      member: {
        user: { id: 'user-e2e' },
      },
      data: {
        custom_id: 'pastify_modal',
        components: [
          {
            components: [
              {
                custom_id: 'pastify_modal_text',
                value: 'jungler forgets smite',
              },
            ],
          },
        ],
      },
    });

    expect(submitRes.status).toBe(200);
    expect((await submitRes.json() as any).type).toBe(InteractionResponseType.DeferredChannelMessageWithSource);

    const followUp = await waitForFollowUp(correlationId);
    const patched = JSON.parse(followUp.body) as Record<string, unknown>;
    expect(typeof patched.content).toBe('string');
    expect((patched.content as string).length).toBeGreaterThan(0);
  });

  it('responds to unknown command with 400', async () => {
    const body = {
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token: 'e2e-test-token',
      data: { name: 'notacommand' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toMatch(/Unknown Command/);
  });
});

