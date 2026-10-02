import type { D1Database, DurableObjectState } from '@cloudflare/workers-types';
import type { CreateChannelMessagePayload } from '@/integrations/discord';
import {
  getNextPendingScheduledMessage,
  listDueScheduledMessages,
  markScheduledMessageCanceled,
  markScheduledMessageFired,
  reclaimStaleFiringScheduledMessages,
  resetScheduledMessageToScheduled,
  tryMarkScheduledMessageFiring,
  upsertScheduledMessage,
} from '@/integrations/scheduledMessages';
import { sendDiscordMessage } from '@/skills/sendDiscordMessage';

interface ReminderTaskPayload {
  channelId: string;
  userId: string;
  length: number;
  interval: 'minutes' | 'hours' | 'days';
  note: string;
}

interface ScheduleReminderTaskRequest {
  reminderId: string;
  scheduledFor: number;
  task: {
    commandName: string;
    payload: ReminderTaskPayload;
  };
}

interface ScheduleMessageRequest {
  scheduleId: string;
  scheduledFor: number;
  channelId: string;
  content: string;
  allowedMentions?: CreateChannelMessagePayload['allowed_mentions'];
}

interface UnscheduleMessageRequest {
  scheduleId: string;
}

export interface SchedulerCoordinatorEnv {
  DISCORD_TOKEN: string;
  DISCORD_API_BASE_URL?: string;
  RELEASES_DB: D1Database;
}

function buildReminderContent(payload: ReminderTaskPayload): string {
  return `<@${payload.userId}> ⏰ Reminder: ${payload.length} ${payload.interval} elapsed.\n📝 ${payload.note}`;
}

function parseReminderScheduleRequest(input: unknown): ScheduleReminderTaskRequest | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const request = input as Partial<ScheduleReminderTaskRequest>;
  const task = request.task;
  const payload = task?.payload;

  const reminderId = typeof request.reminderId === 'string' ? request.reminderId.trim() : '';
  if (!reminderId || typeof request.scheduledFor !== 'number' || !Number.isFinite(request.scheduledFor) || !task || typeof task !== 'object' || typeof task.commandName !== 'string' || !payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Partial<ReminderTaskPayload>;
  const channelId = typeof candidate.channelId === 'string' ? candidate.channelId.trim() : '';
  const userId = typeof candidate.userId === 'string' ? candidate.userId.trim() : '';
  const note = typeof candidate.note === 'string' ? candidate.note.trim() : '';

  if (
    !channelId
    || !userId
    || typeof candidate.length !== 'number'
    || !Number.isInteger(candidate.length)
    || candidate.length <= 0
    || (candidate.interval !== 'minutes' && candidate.interval !== 'hours' && candidate.interval !== 'days')
    || !note
  ) {
    return null;
  }

  return {
    reminderId,
    scheduledFor: Math.floor(request.scheduledFor),
    task: {
      commandName: task.commandName,
      payload: {
        channelId,
        userId,
        length: candidate.length,
        interval: candidate.interval,
        note,
      },
    },
  };
}

function parseScheduleMessageRequest(input: unknown): ScheduleMessageRequest | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const request = input as Partial<ScheduleMessageRequest>;
  const scheduleId = typeof request.scheduleId === 'string' ? request.scheduleId.trim() : '';
  const channelId = typeof request.channelId === 'string' ? request.channelId.trim() : '';
  const content = typeof request.content === 'string' ? request.content.trim() : '';

  if (
    !scheduleId
    || !channelId
    || !content
    || typeof request.scheduledFor !== 'number'
    || !Number.isFinite(request.scheduledFor)
  ) {
    return null;
  }

  return {
    scheduleId,
    scheduledFor: Math.floor(request.scheduledFor),
    channelId,
    content,
    allowedMentions: request.allowedMentions ?? { parse: [] },
  };
}

function parseUnscheduleRequest(input: unknown): UnscheduleMessageRequest | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const request = input as Partial<UnscheduleMessageRequest>;
  const scheduleId = typeof request.scheduleId === 'string' ? request.scheduleId.trim() : '';
  if (!scheduleId) {
    return null;
  }

  return { scheduleId };
}

function releaseSourceKeyFromScheduleId(scheduleId: string): string {
  if (scheduleId.startsWith('release:')) {
    return scheduleId.slice('release:'.length);
  }

  return scheduleId;
}

async function resetAlarmToNextScheduled(
  state: DurableObjectState,
  db: D1Database,
): Promise<void> {
  await reclaimStaleFiringScheduledMessages(db);

  const next = await getNextPendingScheduledMessage(db);
  if (!next) {
    await state.storage.deleteAlarm();
    return;
  }

  await state.storage.setAlarm(Math.max(Date.now(), next.scheduledFor));
}

export class ReminderDurableObject {
  private readonly state: DurableObjectState;
  private readonly env: SchedulerCoordinatorEnv;
  private initializationPromise: Promise<void> | null = null;

  constructor(state: DurableObjectState, env: SchedulerCoordinatorEnv) {
    this.state = state;
    this.env = env;
    this.initializationPromise = this.initializeFromDatabase();
  }

  private async initializeFromDatabase(): Promise<void> {
    if (!this.state.storage || typeof this.state.storage.get !== 'function') {
      return;
    }

    const initialized = await this.state.storage.get<boolean>('scheduler-bootstrap');
    if (initialized) {
      return;
    }

    await reclaimStaleFiringScheduledMessages(this.env.RELEASES_DB);
    const next = await getNextPendingScheduledMessage(this.env.RELEASES_DB);
    if (!next) {
      await this.state.storage.deleteAlarm();
      await this.state.storage.put('scheduler-bootstrap', true);
      return;
    }

    await this.state.storage.setAlarm(Math.max(Date.now(), next.scheduledFor));
    await this.state.storage.put('scheduler-bootstrap', true);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeFromDatabase();
    }

    await this.initializationPromise;
  }

  fetch(request: Request): Promise<Response> {
    return this.ensureInitialized().then(() => handleSchedulerCoordinatorRequest(this.state, this.env, request));
  }

  alarm(): Promise<void> {
    return this.ensureInitialized().then(() => runSchedulerCoordinatorAlarm(this.state, this.env));
  }
}

export async function handleSchedulerCoordinatorRequest(
  state: DurableObjectState,
  env: SchedulerCoordinatorEnv,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === '/unschedule-message') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid unschedule payload', { status: 400 });
    }

    const parsed = parseUnscheduleRequest(body);
    if (!parsed) {
      return new Response('Invalid unschedule payload', { status: 400 });
    }

    await markScheduledMessageCanceled(env.RELEASES_DB, parsed.scheduleId);
    await resetAlarmToNextScheduled(state, env.RELEASES_DB);
    return new Response(null, { status: 204 });
  }

  if (request.method === 'POST' && url.pathname === '/schedule-message') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid schedule payload', { status: 400 });
    }

    const parsed = parseScheduleMessageRequest(body);
    if (!parsed) {
      return new Response('Invalid schedule payload', { status: 400 });
    }

    await upsertScheduledMessage(env.RELEASES_DB, {
      scheduleKey: parsed.scheduleId,
      scheduleType: 'release',
      sourceKey: releaseSourceKeyFromScheduleId(parsed.scheduleId),
      channelId: parsed.channelId,
      scheduledFor: parsed.scheduledFor,
      content: parsed.content,
      allowedMentionsJson: JSON.stringify(parsed.allowedMentions ?? { parse: [] }),
      status: 'scheduled',
      firedAt: null,
    });

    await resetAlarmToNextScheduled(state, env.RELEASES_DB);
    return new Response(null, { status: 204 });
  }

  if (request.method === 'POST' && url.pathname === '/schedule') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid schedule payload', { status: 400 });
    }

    const parsed = parseReminderScheduleRequest(body);
    if (!parsed) {
      return new Response('Invalid schedule payload', { status: 400 });
    }

    await upsertScheduledMessage(env.RELEASES_DB, {
      scheduleKey: `reminder:${parsed.reminderId}`,
      scheduleType: 'reminder',
      sourceKey: parsed.reminderId,
      channelId: parsed.task.payload.channelId,
      scheduledFor: parsed.scheduledFor,
      content: buildReminderContent(parsed.task.payload),
      allowedMentionsJson: JSON.stringify({
        parse: [],
        users: [parsed.task.payload.userId],
      }),
      status: 'scheduled',
      firedAt: null,
    });

    await resetAlarmToNextScheduled(state, env.RELEASES_DB);
    return new Response(null, { status: 204 });
  }

  return new Response('Not found', { status: 404 });
}

function parseAllowedMentions(allowedMentionsJson: string): CreateChannelMessagePayload['allowed_mentions'] {
  try {
    const parsed = JSON.parse(allowedMentionsJson) as CreateChannelMessagePayload['allowed_mentions'];
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Fall through to default.
  }

  return { parse: [] };
}

function getRetryBackoffMs(attempts: number): number {
  const exponentialBackoffMs = Math.min(5 * 60 * 1000, 1_000 * (2 ** Math.max(0, attempts - 1)));
  return exponentialBackoffMs;
}

export async function runSchedulerCoordinatorAlarm(
  state: DurableObjectState,
  env: SchedulerCoordinatorEnv,
): Promise<void> {
  const nowMs = Date.now();
  await reclaimStaleFiringScheduledMessages(env.RELEASES_DB, nowMs, 5 * 60 * 1000);
  const dueMessages = await listDueScheduledMessages(env.RELEASES_DB, nowMs, 25);
  let firstError: unknown = null;

  for (const message of dueMessages) {
    const claimed = await tryMarkScheduledMessageFiring(env.RELEASES_DB, message.scheduleKey);
    if (!claimed) {
      continue;
    }

    try {
      await sendDiscordMessage(
        {
          channelId: message.channelId,
          content: message.content,
          allowedMentions: parseAllowedMentions(message.allowedMentionsJson),
          failurePrefix: 'Scheduled message delivery failed',
        },
        env,
      );
      await markScheduledMessageFired(env.RELEASES_DB, message.scheduleKey, new Date().toISOString());
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      const nextAttemptAt = Date.now() + getRetryBackoffMs(message.attempts);
      await resetScheduledMessageToScheduled(env.RELEASES_DB, message.scheduleKey, messageText, nextAttemptAt);
      if (!firstError) {
        firstError = error;
      }
    }
  }

  await resetAlarmToNextScheduled(state, env.RELEASES_DB);

  if (firstError) {
    if (firstError instanceof Error) {
      throw firstError;
    }

    if (typeof firstError === 'string') {
      throw new Error(firstError);
    }

    throw new Error(`Scheduler alarm failed: ${JSON.stringify(firstError)}`);
  }
}
