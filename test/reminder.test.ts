import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReminderDurableObject } from '../src/reminder.js';

type StoredValue = Record<string, unknown>;

function createMockState() {
  let storedReminder: StoredValue | undefined;
  let alarmTime: number | null = null;

  const state = {
    storage: {
      get: vi.fn(() => Promise.resolve(storedReminder)),
      put: vi.fn((_key: string, value: StoredValue) => {
        storedReminder = value;
        return Promise.resolve();
      }),
      setAlarm: vi.fn((time: number) => {
        alarmTime = time;
        return Promise.resolve();
      }),
    },
  };

  return {
    state,
    getStoredReminder: () => storedReminder,
    getAlarmTime: () => alarmTime,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReminderDurableObject', () => {
  it('stores reminder payload and sets durable alarm when scheduled', async () => {
    const mockState = createMockState();
    const reminder = new ReminderDurableObject(mockState.state as any, {
      DISCORD_TOKEN: 'test-token',
      DISCORD_API_BASE_URL: 'https://discord.com/api/v10',
    });

    const scheduledFor = Date.now() + 60_000;
    const response = await reminder.fetch(new Request('https://reminder.internal/schedule', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reminderId: 'reminder-1',
        scheduledFor,
        task: {
          commandName: 'reminder',
          payload: {
            channelId: 'channel-1',
            userId: 'user-1',
            length: 1,
            interval: 'minutes',
            note: 'join the standup',
          },
        },
      }),
    }));

    expect(response.status).toBe(204);
    expect(mockState.getAlarmTime()).toBeGreaterThanOrEqual(Date.now());

    expect(mockState.getStoredReminder()).toMatchObject({
      reminderId: 'reminder-1',
      task: {
        commandName: 'reminder',
        payload: {
          channelId: 'channel-1',
          userId: 'user-1',
          length: 1,
          interval: 'minutes',
          note: 'join the standup',
        },
      },
      attempts: 0,
    });
  });

  it('posts the reminder message on alarm and marks reminder as fired', async () => {
    const mockState = createMockState();
    const reminder = new ReminderDurableObject(mockState.state as any, {
      DISCORD_TOKEN: 'test-token',
      DISCORD_API_BASE_URL: 'https://discord.com/api/v10',
    });

    await reminder.fetch(new Request('https://reminder.internal/schedule', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reminderId: 'reminder-2',
        scheduledFor: Date.now() + 30_000,
        task: {
          commandName: 'reminder',
          payload: {
            channelId: 'channel-2',
            userId: 'user-2',
            length: 3,
            interval: 'hours',
            note: 'ship the hotfix',
          },
        },
      }),
    }));

    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"msg-1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await reminder.alarm();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/channel-2/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '<@user-2> ⏰ Reminder: 3 hours elapsed.\n📝 ship the hotfix',
          allowed_mentions: {
            users: ['user-2'],
          },
        }),
      }),
    );

    expect(mockState.getStoredReminder()).toMatchObject({
      reminderId: 'reminder-2',
      attempts: 1,
    });
    expect(mockState.getStoredReminder()?.firedAt).toBeTypeOf('string');
  });
});
