import type {
  FollowUpExecutionContext,
  FollowUpExecutionResult,
  FollowUpTask,
} from '@/core';
import type { AiRuntimeEnv } from '@/skills/ai';
import { deliverFollowUpEdit, type DeliverFollowUpEnv } from '@/skills/discordInteraction';
import {
  EIGHT_BALL_COMMAND_NAME,
  executeEightBallFollowUp,
} from '@/commands/8ball';
import {
  INSULT_COMMAND_NAME,
  executeInsultFollowUp,
} from '@/commands/insult';
import {
  executeIssueFollowUp,
  ISSUE_COMMAND_NAME,
  type IssueRuntimeEnv,
} from '@/commands/issue';
import {
  executePastifyFollowUp,
  PASTIFY_COMMAND_NAME,
} from '@/commands/pastify';
import {
  executeReleaseFollowUp,
  RELEASE_COMMAND_NAME,
  type ReleaseRuntimeEnv,
} from '@/commands/release';
import {
  executeScheduledFollowUp,
  SCHEDULED_COMMAND_NAME,
  type ScheduledRuntimeEnv,
} from '@/commands/scheduled';

export type FollowUpDeliveryEnv =
  AiRuntimeEnv
  & DeliverFollowUpEnv
  & IssueRuntimeEnv
  & ReleaseRuntimeEnv
  & ScheduledRuntimeEnv;

export async function executeFollowUpTask(
  task: FollowUpTask,
  env: AiRuntimeEnv & ReleaseRuntimeEnv,
  context: FollowUpExecutionContext,
  issueEnv?: IssueRuntimeEnv,
): Promise<FollowUpExecutionResult> {
  if (task.commandName === PASTIFY_COMMAND_NAME) {
    return executePastifyFollowUp(task, env, context);
  }

  if (task.commandName === INSULT_COMMAND_NAME) {
    return executeInsultFollowUp(task, env, context);
  }

  if (task.commandName === EIGHT_BALL_COMMAND_NAME) {
    return executeEightBallFollowUp(task, env, context);
  }

  if (task.commandName === ISSUE_COMMAND_NAME) {
    if (!issueEnv) {
      throw new Error('Issue follow-up requires GitHub configuration');
    }
    return executeIssueFollowUp(task, issueEnv, context);
  }

  if (task.commandName === RELEASE_COMMAND_NAME) {
    return executeReleaseFollowUp(task, env);
  }

  if (task.commandName === SCHEDULED_COMMAND_NAME) {
    return executeScheduledFollowUp(task, env);
  }

  throw new Error(`Unknown follow-up task command: ${task.commandName}`);
}

export async function executeAndDeliverFollowUp(
  task: FollowUpTask | undefined,
  context: FollowUpExecutionContext,
  env: FollowUpDeliveryEnv,
): Promise<void> {
  const result: FollowUpExecutionResult = task
    ? await executeFollowUpTask(
      task,
      {
        AI: env.AI,
        RELEASES_DB: env.RELEASES_DB,
        REMINDER_SCHEDULER: env.REMINDER_SCHEDULER,
      },
      context,
      env,
    )
    : { content: 'Could not process follow-up payload. Please try again.' };

  await deliverFollowUpEdit(context.token, result, env);
}
