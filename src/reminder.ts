import type {
  DurableObjectNamespace,
  DurableObjectState,
} from '@cloudflare/workers-types';
import type { FollowUpTask } from './core/index.js';
import { sendDiscordMessage } from './skills/sendDiscordMessage.js';

export type ReminderInterval = 'minutes' | 'hours' | 'days';

export const REMINDER_INTERVAL_SECONDS: Record<ReminderInterval, number> = {
  minutes: 60,
  hours: 60 * 60,
  days: 60 * 60 * 24,
};

type ReminderTaskPayload = {
  channelId: string;
  userId: string;
  length: number;
  interval: ReminderInterval;
  note: string;
};

type ReminderTask = {
  commandName: string;
  payload: ReminderTaskPayload;
};

type ScheduleReminderTaskRequest = {
  reminderId: string;
  scheduledFor: number;
  task: ReminderTask;
};

type PersistedReminderTask = ScheduleReminderTaskRequest & {
  attempts: number;
  firedAt?: string;
};

export interface ReminderSchedulerBinding {
  REMINDER_SCHEDULER: DurableObjectNamespace;
}

export interface ReminderAlarmEnv {
  DISCORD_TOKEN: string;
  DISCORD_API_BASE_URL?: string;
}

const REMINDER_STORAGE_KEY = 'reminder-task';

export function parseReminderLength(value: string | number | boolean | undefined): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

export function parseReminderInterval(value: string | number | boolean | undefined): ReminderInterval | null {
  if (typeof value !== 'string') {
    return null;
  }

  const interval = value.toLowerCase();
  if (interval === 'minutes' || interval === 'hours' || interval === 'days') {
    return interval;
  }

  return null;
}

export function toReminderDelaySeconds(length: number, interval: ReminderInterval): number {
  return length * REMINDER_INTERVAL_SECONDS[interval];
}

function isReminderTaskPayload(payload: Record<string, unknown>): payload is ReminderTaskPayload {
  if (typeof payload.channelId !== 'string') {
    return false;
  }

  if (typeof payload.userId !== 'string') {
    return false;
  }

  if (typeof payload.length !== 'number' || !Number.isInteger(payload.length) || payload.length <= 0) {
    return false;
  }

  if (payload.interval !== 'minutes' && payload.interval !== 'hours' && payload.interval !== 'days') {
    return false;
  }

  if (typeof payload.note !== 'string' || !payload.note.trim()) {
    return false;
  }

  return true;
}

function parseReminderTask(task: FollowUpTask): ReminderTask {
  if (typeof task.commandName !== 'string') {
    throw new Error('Reminder task command name is invalid');
  }

  if (!isReminderTaskPayload(task.payload)) {
    throw new Error('Reminder task payload is invalid');
  }

  return {
    commandName: task.commandName,
    payload: task.payload,
  };
}

function buildReminderContent(payload: ReminderTaskPayload): string {
  return `<@${payload.userId}> ⏰ Reminder: ${payload.length} ${payload.interval} elapsed.\n📝 ${payload.note}`;
}

export async function scheduleReminderTaskWithAlarm(
  task: FollowUpTask,
  delaySeconds: number,
  env: ReminderSchedulerBinding,
): Promise<void> {
  if (!Number.isFinite(delaySeconds) || delaySeconds <= 0) {
    throw new Error('Reminder delay must be a positive number');
  }

  const reminderTask = parseReminderTask(task);
  const reminderId = crypto.randomUUID();
  const scheduledFor = Date.now() + Math.round(delaySeconds * 1000);

  const id = env.REMINDER_SCHEDULER.idFromName(reminderId);
  const stub = env.REMINDER_SCHEDULER.get(id);

  const response = await stub.fetch('https://reminder.internal/schedule', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      reminderId,
      scheduledFor,
      task: reminderTask,
    } satisfies ScheduleReminderTaskRequest),
  });

  if (!response.ok) {
    const details = (await response.text()).trim();
    const suffix = details ? ` ${details}` : '';
    throw new Error(`Failed to schedule reminder alarm: ${response.status}${suffix}`);
  }
}

export class ReminderDurableObject {
  private readonly state: DurableObjectState;
  private readonly env: ReminderAlarmEnv;

  constructor(state: DurableObjectState, env: ReminderAlarmEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/schedule') {
      return new Response('Not found', { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid schedule payload', { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return new Response('Invalid schedule payload', { status: 400 });
    }

    const schedule = body as Partial<ScheduleReminderTaskRequest>;
    if (
      typeof schedule.reminderId !== 'string'
      || typeof schedule.scheduledFor !== 'number'
      || !Number.isFinite(schedule.scheduledFor)
      || !schedule.task
      || typeof schedule.task !== 'object'
      || typeof schedule.task.commandName !== 'string'
      || !schedule.task.payload
      || typeof schedule.task.payload !== 'object'
    ) {
      return new Response('Invalid schedule payload', { status: 400 });
    }

    let parsedTask: ReminderTask;
    try {
      parsedTask = parseReminderTask({
        commandName: schedule.task.commandName,
        payload: schedule.task.payload,
      });
    } catch {
      return new Response('Invalid schedule payload', { status: 400 });
    }

    const existingReminder = await this.state.storage.get<PersistedReminderTask>(REMINDER_STORAGE_KEY);
    if (existingReminder?.firedAt) {
      return new Response('Reminder already fired', { status: 409 });
    }

    const scheduledFor = Math.max(Date.now(), Math.floor(schedule.scheduledFor));
    await this.state.storage.put(REMINDER_STORAGE_KEY, {
      reminderId: schedule.reminderId,
      scheduledFor,
      task: parsedTask,
      attempts: existingReminder?.attempts ?? 0,
      firedAt: existingReminder?.firedAt,
    } satisfies PersistedReminderTask);
    await this.state.storage.setAlarm(scheduledFor);

    return new Response(null, { status: 204 });
  }

  async alarm(): Promise<void> {
    const reminder = await this.state.storage.get<PersistedReminderTask>(REMINDER_STORAGE_KEY);
    if (!reminder || reminder.firedAt) {
      return;
    }

    try {
      await sendDiscordMessage(
        {
          channelId: reminder.task.payload.channelId,
          content: buildReminderContent(reminder.task.payload),
          allowedMentions: {
            parse: [],
            users: [reminder.task.payload.userId],
          },
          failurePrefix: 'Reminder delivery failed',
        },
        this.env,
      );
    } catch (error) {
      await this.state.storage.put(REMINDER_STORAGE_KEY, {
        ...reminder,
        attempts: reminder.attempts + 1,
      } satisfies PersistedReminderTask);

      throw error;
    }

    await this.state.storage.put(REMINDER_STORAGE_KEY, {
      ...reminder,
      attempts: reminder.attempts + 1,
      firedAt: new Date().toISOString(),
    } satisfies PersistedReminderTask);
  }
}
