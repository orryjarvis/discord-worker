import type {
  CommandRequest,
  CommandResult,
  FollowUpExecutionResult,
  FollowUpTask,
} from '@/core';
import {
  scheduleChannelMessageAtWithAlarm,
  unscheduleChannelMessageAlarm,
  type ReminderSchedulerBinding,
} from '@/skills/reminderScheduler';
import {
  buildReleaseScheduledMessage,
  cancelReleaseScheduledMessageRecord,
  formatReleaseList,
  listReleases,
  normalizeReleaseTitle,
  upsertRelease,
  upsertReleaseScheduledMessageRecord,
  validateReleaseDateParts,
  type ReleaseStoreEnv,
} from '@/skills/releases';

export const RELEASE_COMMAND_NAME = 'release';

type ReleaseListPayload = {
  action: 'list';
};

type ReleaseSetPayload = {
  action: 'set';
  channelId: string;
  title: string;
  year: number | null;
  quarter: number | null;
  month: number | null;
  day: number | null;
};

type ReleasePayload = ReleaseListPayload | ReleaseSetPayload;

export type ReleaseRuntimeEnv = ReleaseStoreEnv & ReminderSchedulerBinding;

function parseIntegerOption(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

function parseTitleOption(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const title = value.trim();
  if (!title) {
    return null;
  }

  return title;
}

export function parseReleaseSubcommand(value: unknown): 'set' | 'list' | null {
  if (value !== 'set' && value !== 'list') {
    return null;
  }

  return value;
}

export function toReleaseSetPayload(options: Record<string, string | number | boolean>, channelId: string | null): ReleaseSetPayload | null {
  if (!channelId) {
    return null;
  }

  const title = parseTitleOption(options.title);
  if (!title) {
    return null;
  }

  return {
    action: 'set',
    channelId,
    title,
    year: parseIntegerOption(options.year),
    quarter: parseIntegerOption(options.quarter),
    month: parseIntegerOption(options.month),
    day: parseIntegerOption(options.day),
  };
}

export function handleReleaseCommand(request: CommandRequest): CommandResult {
  switch (request.kind) {
    case 'command': {
      const subcommand = parseReleaseSubcommand(request.options.subcommand);
      if (subcommand === 'list') {
        return {
          kind: 'enqueue-follow-up',
          token: request.token,
          task: {
            commandName: RELEASE_COMMAND_NAME,
            payload: {
              action: 'list',
            },
          },
          ephemeral: false,
        };
      }

      if (subcommand === 'set') {
        const payload = toReleaseSetPayload(request.options, request.channelId);
        if (!payload) {
          return {
            kind: 'channel-message',
            content: 'Usage: /release set title:<text> [year:<number>] [quarter:<1-4>] [month:<1-12>] [day:<1-31>]',
            ephemeral: true,
          };
        }

        return {
          kind: 'enqueue-follow-up',
          token: request.token,
          task: {
            commandName: RELEASE_COMMAND_NAME,
            payload,
          },
          ephemeral: false,
        };
      }

      return {
        kind: 'channel-message',
        content: 'Usage: /release list or /release set title:<text> [year] [quarter] [month] [day]',
        ephemeral: true,
      };
    }

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}

function parseReleasePayload(task: FollowUpTask): ReleasePayload {
  if (!task.payload || typeof task.payload !== 'object') {
    throw new Error('Release task payload is invalid');
  }

  const payload = task.payload as Partial<ReleasePayload> & Record<string, unknown>;
  if (payload.action === 'list') {
    return { action: 'list' };
  }

  if (payload.action !== 'set') {
    throw new Error('Release task action is invalid');
  }

  if (typeof payload.channelId !== 'string') {
    throw new Error('Release task channel is invalid');
  }

  if (typeof payload.title !== 'string') {
    throw new Error('Release task title is invalid');
  }

  const toNullableInteger = (value: unknown): number | null => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error('Release task date parts are invalid');
    }

    return value;
  };

  return {
    action: 'set',
    channelId: payload.channelId,
    title: payload.title,
    year: toNullableInteger(payload.year),
    quarter: toNullableInteger(payload.quarter),
    month: toNullableInteger(payload.month),
    day: toNullableInteger(payload.day),
  };
}

function toReleaseScheduleId(titleNormalized: string): string {
  return `release:${titleNormalized}`;
}

async function handleReleaseSet(
  payload: ReleaseSetPayload,
  env: ReleaseRuntimeEnv,
): Promise<string> {
  const titleNormalized = normalizeReleaseTitle(payload.title);
  const validationError = validateReleaseDateParts(payload);
  if (validationError) {
    return `Could not save release: ${validationError}`;
  }

  await upsertRelease(env, {
    title: payload.title,
    titleNormalized,
    channelId: payload.channelId,
    year: payload.year,
    quarter: payload.quarter,
    month: payload.month,
    day: payload.day,
  });

  const scheduleId = toReleaseScheduleId(titleNormalized);
  const scheduledMessage = buildReleaseScheduledMessage({
    title: payload.title,
    titleNormalized,
    channelId: payload.channelId,
    year: payload.year,
    quarter: payload.quarter,
    month: payload.month,
    day: payload.day,
  });

  if (scheduledMessage) {
    await upsertReleaseScheduledMessageRecord(env, {
      title: payload.title,
      titleNormalized,
      channelId: payload.channelId,
      year: payload.year,
      quarter: payload.quarter,
      month: payload.month,
      day: payload.day,
    }, scheduledMessage);

    await scheduleChannelMessageAtWithAlarm(
      {
        scheduleId,
        scheduledFor: scheduledMessage.scheduledFor,
        channelId: payload.channelId,
        content: scheduledMessage.content,
        allowedMentions: { parse: [] },
      },
      env,
    );
  } else {
    await cancelReleaseScheduledMessageRecord(env, titleNormalized);
    await unscheduleChannelMessageAlarm(scheduleId, env);
  }

  const releases = await listReleases(env);
  return formatReleaseList(releases);
}

export async function executeReleaseFollowUp(
  task: FollowUpTask,
  env: ReleaseRuntimeEnv,
): Promise<FollowUpExecutionResult> {
  const payload = parseReleasePayload(task);

  if (payload.action === 'list') {
    const releases = await listReleases(env);
    return { content: formatReleaseList(releases) };
  }

  return { content: await handleReleaseSet(payload, env) };
}
