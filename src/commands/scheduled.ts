import type {
  CommandRequest,
  CommandResult,
  FollowUpExecutionResult,
  FollowUpTask,
} from '@/core';
import {
  formatScheduledList,
  listScheduledMetadata,
  type ScheduledStoreEnv,
} from '@/skills/scheduled';

export const SCHEDULED_COMMAND_NAME = 'scheduled';

type ScheduledPayload = {
  action: 'list';
};

function parseScheduledPayload(task: FollowUpTask): ScheduledPayload {
  if (!task.payload || typeof task.payload !== 'object') {
    throw new Error('Scheduled task payload is invalid');
  }

  const payload = task.payload as Partial<ScheduledPayload>;
  if (payload.action !== 'list') {
    throw new Error('Scheduled task action is invalid');
  }

  return { action: 'list' };
}

export function handleScheduledCommand(request: CommandRequest): CommandResult {
  switch (request.kind) {
    case 'command':
      return {
        kind: 'enqueue-follow-up',
        token: request.token,
        task: {
          commandName: SCHEDULED_COMMAND_NAME,
          payload: {
            action: 'list',
          },
        },
        ephemeral: true,
      };

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}

export type ScheduledRuntimeEnv = ScheduledStoreEnv;

export async function executeScheduledFollowUp(
  task: FollowUpTask,
  env: ScheduledRuntimeEnv,
): Promise<FollowUpExecutionResult> {
  parseScheduledPayload(task);
  const records = await listScheduledMetadata(env);
  return {
    content: formatScheduledList(records),
  };
}
