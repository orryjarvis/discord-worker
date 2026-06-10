import type { FollowUpExecutionResult, FollowUpTask } from '@/core';
import {
  scheduleChannelMessageAtWithAlarm,
  unscheduleChannelMessageAlarm,
  type ReminderSchedulerBinding,
} from '@/commands/reminder';
import {
  formatReleaseList,
  hasExactReleaseDate,
  listReleases,
  normalizeReleaseTitle,
  toExactReleaseDate,
  upsertRelease,
  validateReleaseDateParts,
  type ReleaseStoreEnv,
} from '@/skills/releases';

export const RELEASE_COMMAND_NAME = 'release';

const RELEASE_NOTIFY_LEAD_DAYS = 7;

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

function formatReleaseAlertContent(title: string, releaseDate: Date): string {
  const releaseDateText = releaseDate.toISOString().slice(0, 10);
  return `Upcoming release hype: **${title}** is scheduled for ${releaseDateText}.`;
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
  if (hasExactReleaseDate(payload)) {
    const releaseDate = toExactReleaseDate(payload);
    if (!releaseDate) {
      throw new Error('Release date conversion failed unexpectedly');
    }

    const notifyAt = Math.max(
      Date.now(),
      releaseDate.getTime() - (RELEASE_NOTIFY_LEAD_DAYS * 24 * 60 * 60 * 1000),
    );

    await scheduleChannelMessageAtWithAlarm(
      {
        scheduleId,
        scheduledFor: notifyAt,
        channelId: payload.channelId,
        content: formatReleaseAlertContent(payload.title, releaseDate),
      },
      env,
    );
  } else {
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
