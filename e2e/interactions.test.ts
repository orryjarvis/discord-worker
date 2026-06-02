import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { listDurableObjectIds, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
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
import { ReminderDurableObject } from '../src/reminder.js';

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
    expect(patched.content).not.toContain('punchline got lost');
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
    expect(patched.content).not.toContain('punchline got lost');
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
    expect((payload.content as string)).not.toContain('cloudy right now');
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
    expect(patched.content).not.toContain('Could not pastify');
  });

  it('schedules a reminder durable object with correct payload when /reminder is invoked', async () => {
    const channelId = `reminder-schedule-test-${Date.now()}`;
    const beforeSchedule = Date.now();

    // Snapshot existing DOs before dispatch so we can find the newly created one after.
    const reminderNamespace = (env as any).REMINDER_SCHEDULER;
    const idsBefore = new Set((await listDurableObjectIds(reminderNamespace)).map((id: { toString(): string }) => id.toString()));

    const res = await signAndSendRequest({
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token: `test-token-reminder-sched-${Date.now()}`,
      channel_id: channelId,
      member: {
        user: {
          id: 'user-reminder-e2e',
        },
      },
      data: {
        name: 'reminder',
        options: [
          {
            name: 'length',
            type: ApplicationCommandOptionType.Integer,
            value: 2,
          },
          {
            name: 'interval',
            type: ApplicationCommandOptionType.String,
            value: 'hours',
          },
          {
            name: 'note',
            type: ApplicationCommandOptionType.String,
            value: 'submit the expense report',
          },
        ],
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json() as any).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'Reminder set for 2 hours.',
        flags: 64,
      },
    });

    // Identify the DO created by this dispatch using a before/after diff.
    const idsAfter = await listDurableObjectIds(reminderNamespace);
    const newIds = idsAfter.filter((id: { toString(): string }) => !idsBefore.has(id.toString()));
    expect(newIds.length).toBe(1);

    const stub = reminderNamespace.get(newIds[0]);
    await runInDurableObject(stub, async (instance: ReminderDurableObject, state) => {
      expect(instance).toBeInstanceOf(ReminderDurableObject);

      const stored = await state.storage.get('reminder-task') as Record<string, unknown>;
      expect(typeof stored.reminderId).toBe('string');
      expect(stored.scheduledFor as number).toBeGreaterThan(beforeSchedule + (2 * 60 * 60 * 1000) - 10_000);
      expect(stored.attempts).toBe(0);
      expect(stored.firedAt).toBeUndefined();

      const task = stored.task as { commandName: string; payload: Record<string, unknown> };
      expect(task.commandName).toBe('reminder');
      expect(task.payload).toMatchObject({
        channelId,
        userId: 'user-reminder-e2e',
        length: 2,
        interval: 'hours',
        note: 'submit the expense report',
      });
    });
  });

  it('delivers a reminder channel message when the durable object alarm fires', async () => {
    const channelId = `reminder-fire-test-${Date.now()}`;
    await clearChannelPost(channelId);

    // Snapshot existing DOs before dispatch so we can find the newly created one after.
    const reminderNamespace = (env as any).REMINDER_SCHEDULER;
    const idsBefore = new Set((await listDurableObjectIds(reminderNamespace)).map((id: { toString(): string }) => id.toString()));

    const res = await signAndSendRequest({
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token: `test-token-reminder-fire-${Date.now()}`,
      channel_id: channelId,
      member: {
        user: {
          id: 'user-alarm-e2e',
        },
      },
      data: {
        name: 'reminder',
        options: [
          {
            name: 'length',
            type: ApplicationCommandOptionType.Integer,
            value: 30,
          },
          {
            name: 'interval',
            type: ApplicationCommandOptionType.String,
            value: 'days',
          },
          {
            name: 'note',
            type: ApplicationCommandOptionType.String,
            value: 'rotate the API keys',
          },
        ],
      },
    });

    expect(res.status).toBe(200);

    const idsAfter = await listDurableObjectIds(reminderNamespace);
    const newIds = idsAfter.filter((id: { toString(): string }) => !idsBefore.has(id.toString()));
    expect(newIds.length).toBe(1);
    const stub = reminderNamespace.get(newIds[0]);

    // Fire the alarm immediately without waiting for the real timer.
    const alarmRan = await runDurableObjectAlarm(stub);
    expect(alarmRan).toBe(true);

    // The alarm handler posts to the channel; the mock server captures it.
    const channelPost = await waitForChannelPost(channelId);
    const payload = JSON.parse(channelPost.body) as Record<string, unknown>;
    expect(payload.content).toContain('<@user-alarm-e2e> ⏰ Reminder: 30 days elapsed.');
    expect(payload.content).toContain('📝 rotate the API keys');

    // Running the alarm a second time returns false (no alarm re-scheduled after delivery).
    const alarmRanAgain = await runDurableObjectAlarm(stub);
    expect(alarmRanAgain).toBe(false);
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

