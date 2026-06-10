import type {
  CreateChannelMessagePayload,
} from '@/integrations/discord';
import type {
  DurableObjectState,
} from '@cloudflare/workers-types';
import type {
  CommandRequest,
  CommandResult,
  FollowUpTask,
} from '@/core';
import { sendDiscordMessage } from '@/skills/sendDiscordMessage';
export { scheduleReminderTaskWithAlarm } from '@/skills/reminderScheduler';

export const REMINDER_COMMAND_NAME = 'reminder';

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

type ScheduleMessageRequest = {
  scheduleId: string;
  scheduledFor: number;
  channelId: string;
  content: string;
  allowedMentions?: CreateChannelMessagePayload['allowed_mentions'];
};

type PersistedScheduledMessage = ScheduleMessageRequest & {
  attempts: number;
  firedAt?: string;
};

export interface ReminderAlarmEnv {
  DISCORD_TOKEN: string;
  DISCORD_API_BASE_URL?: string;
}

const REMINDER_STORAGE_KEY = 'reminder-task';
const MESSAGE_STORAGE_KEY = 'scheduled-message-task';

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

function parseReminderNote(value: string | number | boolean | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const note = value.trim();
  if (!note) {
    return null;
  }

  return note;
}

export function handleReminderCommand(request: CommandRequest): CommandResult {
  switch (request.kind) {
    case 'command': {
      const length = parseReminderLength(request.options.length);
      const interval = parseReminderInterval(request.options.interval);
      const note = parseReminderNote(request.options.note);
      if (!length || !interval || !note) {
        return {
          kind: 'channel-message',
          content: 'Usage: /reminder length:<number> interval:<minutes|hours|days> note:<text>',
          ephemeral: true,
        };
      }

      if (length < 1) {
        return {
          kind: 'channel-message',
          content: 'Length must be at least 1.',
          ephemeral: true,
        };
      }

      if (!request.channelId || !request.userId) {
        return {
          kind: 'channel-message',
          content: 'Could not schedule reminder from this context.',
          ephemeral: true,
        };
      }

      return {
        kind: 'ack-and-schedule-task',
        content: `Reminder set for ${length} ${interval}.`,
        task: {
          commandName: REMINDER_COMMAND_NAME,
          payload: {
            channelId: request.channelId,
            userId: request.userId,
            length,
            interval,
            note,
          },
        },
        ephemeral: true,
        delaySeconds: toReminderDelaySeconds(length, interval),
      };
    }

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
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

function isAllowedMentions(
  value: unknown,
): value is CreateChannelMessagePayload['allowed_mentions'] {
  if (typeof value === 'undefined') {
    return true;
  }

  return Boolean(value) && typeof value === 'object';
}

function parseScheduleMessageRequest(input: unknown): ScheduleMessageRequest | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const schedule = input as Partial<ScheduleMessageRequest>;
  if (typeof schedule.scheduleId !== 'string' || !schedule.scheduleId.trim()) {
    return null;
  }

  if (typeof schedule.channelId !== 'string' || !schedule.channelId.trim()) {
    return null;
  }

  if (typeof schedule.content !== 'string' || !schedule.content.trim()) {
    return null;
  }

  if (typeof schedule.scheduledFor !== 'number' || !Number.isFinite(schedule.scheduledFor)) {
    return null;
  }

  if (!isAllowedMentions(schedule.allowedMentions)) {
    return null;
  }

  return {
    scheduleId: schedule.scheduleId,
    scheduledFor: Math.floor(schedule.scheduledFor),
    channelId: schedule.channelId,
    content: schedule.content,
    allowedMentions: schedule.allowedMentions ?? { parse: [] },
  };
}

function isPersistedScheduledMessage(value: unknown): value is PersistedScheduledMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedScheduledMessage>;
  return typeof candidate.scheduleId === 'string'
    && typeof candidate.channelId === 'string'
    && typeof candidate.content === 'string'
    && typeof candidate.scheduledFor === 'number'
    && typeof candidate.attempts === 'number';
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
    if (request.method === 'POST' && url.pathname === '/unschedule-message') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response('Invalid unschedule payload', { status: 400 });
      }

      if (!body || typeof body !== 'object') {
        return new Response('Invalid unschedule payload', { status: 400 });
      }

      const payload = body as Partial<{ scheduleId: string }>;
      if (typeof payload.scheduleId !== 'string' || !payload.scheduleId.trim()) {
        return new Response('Invalid unschedule payload', { status: 400 });
      }

      const existingMessage = await this.state.storage.get<PersistedScheduledMessage>(MESSAGE_STORAGE_KEY);
      if (existingMessage?.scheduleId === payload.scheduleId) {
        await this.state.storage.delete(MESSAGE_STORAGE_KEY);
        await this.state.storage.deleteAlarm();
      }

      return new Response(null, { status: 204 });
    }

    if (request.method === 'POST' && url.pathname === '/schedule-message') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response('Invalid schedule payload', { status: 400 });
      }

      const schedule = parseScheduleMessageRequest(body);
      if (!schedule) {
        return new Response('Invalid schedule payload', { status: 400 });
      }

      const scheduledFor = Math.max(Date.now(), schedule.scheduledFor);
      await this.state.storage.put(MESSAGE_STORAGE_KEY, {
        ...schedule,
        scheduledFor,
        attempts: 0,
        firedAt: undefined,
      } satisfies PersistedScheduledMessage);
      await this.state.storage.setAlarm(scheduledFor);

      return new Response(null, { status: 204 });
    }

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
    const scheduledMessageRaw = await this.state.storage.get<unknown>(MESSAGE_STORAGE_KEY);
    if (isPersistedScheduledMessage(scheduledMessageRaw) && !scheduledMessageRaw.firedAt) {
      try {
        await sendDiscordMessage(
          {
            channelId: scheduledMessageRaw.channelId,
            content: scheduledMessageRaw.content,
            allowedMentions: scheduledMessageRaw.allowedMentions,
            failurePrefix: 'Scheduled message delivery failed',
          },
          this.env,
        );
      } catch (error) {
        await this.state.storage.put(MESSAGE_STORAGE_KEY, {
          ...scheduledMessageRaw,
          attempts: scheduledMessageRaw.attempts + 1,
        } satisfies PersistedScheduledMessage);

        throw error;
      }

      await this.state.storage.put(MESSAGE_STORAGE_KEY, {
        ...scheduledMessageRaw,
        attempts: scheduledMessageRaw.attempts + 1,
        firedAt: new Date().toISOString(),
      } satisfies PersistedScheduledMessage);
      return;
    }

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
