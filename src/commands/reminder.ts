import type {
  DurableObjectState,
} from '@cloudflare/workers-types';
import type {
  CommandRequest,
  CommandResult,
} from '@/core';
import {
  handleSchedulerCoordinatorRequest,
  runSchedulerCoordinatorAlarm,
  type SchedulerCoordinatorEnv,
} from '@/skills/schedulerCoordinator';
export { scheduleReminderTaskWithAlarm } from '@/skills/reminderScheduler';

export const REMINDER_COMMAND_NAME = 'reminder';

export type ReminderInterval = 'minutes' | 'hours' | 'days';

export const REMINDER_INTERVAL_SECONDS: Record<ReminderInterval, number> = {
  minutes: 60,
  hours: 60 * 60,
  days: 60 * 60 * 24,
};

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
            requestToken: request.token,
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

export class ReminderDurableObject {
  private readonly state: DurableObjectState;
  private readonly env: ReminderAlarmEnv;

  constructor(state: DurableObjectState, env: ReminderAlarmEnv) {
    this.state = state;
    this.env = env;
  }

  fetch(request: Request): Promise<Response> {
    return handleSchedulerCoordinatorRequest(this.state, this.env, request);
  }

  alarm(): Promise<void> {
    return runSchedulerCoordinatorAlarm(this.state, this.env);
  }
}

export type ReminderAlarmEnv = SchedulerCoordinatorEnv;
