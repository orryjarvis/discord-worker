import { describe, expect, it, vi } from 'vitest';
import { ReminderDurableObject } from '@/commands/reminder';
import {
  handleSchedulerCoordinatorRequest,
  runSchedulerCoordinatorAlarm,
} from '@/skills/schedulerCoordinator';
import {
  markScheduledMessageFired,
  reclaimStaleFiringScheduledMessages,
} from '@/integrations/scheduledMessages';

vi.mock('@/skills/schedulerCoordinator', () => ({
  handleSchedulerCoordinatorRequest: vi.fn(),
  runSchedulerCoordinatorAlarm: vi.fn(),
}));

describe('ReminderDurableObject', () => {
  it('delegates fetch requests to scheduler coordinator request handler', async () => {
    const expected = new Response(null, { status: 204 });
    vi.mocked(handleSchedulerCoordinatorRequest).mockResolvedValue(expected);

    const state = { storage: {} } as any;
    const env = {
      DISCORD_TOKEN: 'test-token',
      DISCORD_API_BASE_URL: 'https://discord.com/api/v10',
      RELEASES_DB: {},
    } as any;
    const durableObject = new ReminderDurableObject(state, env);

    const request = new Request('https://reminder.internal/schedule', {
      method: 'POST',
      body: JSON.stringify({ reminderId: 'abc', scheduledFor: Date.now(), task: {} }),
    });

    const response = await durableObject.fetch(request);

    expect(response).toBe(expected);
    expect(handleSchedulerCoordinatorRequest).toHaveBeenCalledWith(state, env, request);
  });

  it('delegates alarm execution to scheduler coordinator alarm runner', async () => {
    vi.mocked(runSchedulerCoordinatorAlarm).mockResolvedValue(undefined);

    const state = { storage: {} } as any;
    const env = {
      DISCORD_TOKEN: 'test-token',
      DISCORD_API_BASE_URL: 'https://discord.com/api/v10',
      RELEASES_DB: {},
    } as any;
    const durableObject = new ReminderDurableObject(state, env);

    await durableObject.alarm();

    expect(runSchedulerCoordinatorAlarm).toHaveBeenCalledWith(state, env);
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
