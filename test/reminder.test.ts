import { describe, expect, it, vi } from 'vitest';
import {
  ReminderDurableObject,
  handleSchedulerCoordinatorRequest,
  runSchedulerCoordinatorAlarm,
} from '@/skills/schedulerCoordinator';
import {
  markScheduledMessageFired,
  reclaimStaleFiringScheduledMessages,
} from '@/integrations/scheduledMessages';

vi.mock('@/skills/schedulerCoordinator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/skills/schedulerCoordinator')>();
  return {
    ...actual,
    handleSchedulerCoordinatorRequest: vi.fn(),
    runSchedulerCoordinatorAlarm: vi.fn(),
  };
});

describe('ReminderDurableObject', () => {
  it('allows initialized durable objects to handle fetch requests without re-running bootstrap', async () => {
    const state = {
      storage: {
        get: vi.fn().mockResolvedValue(true),
        deleteAlarm: vi.fn().mockResolvedValue(undefined),
        setAlarm: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
    const env = {
      DISCORD_TOKEN: 'test-token',
      DISCORD_API_BASE_URL: 'https://discord.com/api/v10',
      RELEASES_DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
            all: vi.fn().mockResolvedValue({ results: [] }),
          })),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        })),
      },
    } as any;
    const durableObject = new ReminderDurableObject(state, env);

    const request = new Request('https://reminder.internal/schedule', {
      method: 'POST',
      body: JSON.stringify({ reminderId: 'abc', scheduledFor: Date.now(), task: {} }),
    });

    const response = await durableObject.fetch(request);

    expect(response.status).toBe(400);
    expect(state.storage.get).toHaveBeenCalledWith('scheduler-bootstrap');
  });

  it('allows initialized durable objects to run alarms without bootstrap races', async () => {
    const state = {
      storage: {
        get: vi.fn().mockResolvedValue(true),
        deleteAlarm: vi.fn().mockResolvedValue(undefined),
        setAlarm: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
    const env = {
      DISCORD_TOKEN: 'test-token',
      DISCORD_API_BASE_URL: 'https://discord.com/api/v10',
      RELEASES_DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
            all: vi.fn().mockResolvedValue({ results: [] }),
          })),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        })),
      },
    } as any;
    const durableObject = new ReminderDurableObject(state, env);

    await expect(durableObject.alarm()).resolves.toBeUndefined();
    expect(state.storage.get).toHaveBeenCalledWith('scheduler-bootstrap');
  });
});

describe('scheduler recovery', () => {
  it('reclaims stale firing rows back to scheduled status before re-delivery', async () => {
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((..._args: unknown[]) => ({
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        })),
      })),
    } as any;

    const reclaimed = await reclaimStaleFiringScheduledMessages(db, Date.now(), 60_000);

    expect(reclaimed).toBe(1);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE scheduled_messages'));
  });

  it('ignores stale firing completion when the row was already canceled', async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ run })),
      })),
    } as any;

    await markScheduledMessageFired(db, 'reminder:cancelled', new Date().toISOString());

    expect(run).toHaveBeenCalled();
    await expect(run.mock.results[0]?.value).resolves.toMatchObject({ meta: { changes: 0 } });
  });
});
