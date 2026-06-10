import type {
  CreateChannelMessagePayload,
} from '@/integrations/discord';
import type {
  FollowUpTask,
} from '@/core';
import type {
  DurableObjectNamespace,
} from '@cloudflare/workers-types';

type ReminderInterval = 'minutes' | 'hours' | 'days';

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

export type ScheduleMessageRequest = {
  scheduleId: string;
  scheduledFor: number;
  channelId: string;
  content: string;
  allowedMentions?: CreateChannelMessagePayload['allowed_mentions'];
};

export interface ReminderSchedulerBinding {
  REMINDER_SCHEDULER: DurableObjectNamespace;
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

export async function scheduleChannelMessageAtWithAlarm(
  input: ScheduleMessageRequest,
  env: ReminderSchedulerBinding,
): Promise<void> {
  const id = env.REMINDER_SCHEDULER.idFromName(input.scheduleId);
  const stub = env.REMINDER_SCHEDULER.get(id);

  const response = await stub.fetch('https://reminder.internal/schedule-message', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const details = (await response.text()).trim();
    const suffix = details ? ` ${details}` : '';
    throw new Error(`Failed to schedule channel message alarm: ${response.status}${suffix}`);
  }
}

export async function unscheduleChannelMessageAlarm(
  scheduleId: string,
  env: ReminderSchedulerBinding,
): Promise<void> {
  const id = env.REMINDER_SCHEDULER.idFromName(scheduleId);
  const stub = env.REMINDER_SCHEDULER.get(id);

  const response = await stub.fetch('https://reminder.internal/unschedule-message', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ scheduleId }),
  });

  if (!response.ok) {
    const details = (await response.text()).trim();
    const suffix = details ? ` ${details}` : '';
    throw new Error(`Failed to unschedule channel message alarm: ${response.status}${suffix}`);
  }
}
