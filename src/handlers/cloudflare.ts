import type { ScheduledController, MessageBatch } from '@cloudflare/workers-types';
import type { FollowUpTask } from '../core/index.js';
import {
  executeAndDeliverFollowUp,
  WOTD_COMMAND_NAME,
  type FollowUpDeliveryEnv,
} from '../commands/index.js';
import {
  postWordOfDayMessage,
  runWordOfDayScheduledActivity,
  type WordOfDayScheduledEnv,
} from '../commands/wordOfDaySchedule.js';

export interface CloudflareHandlerEnv extends FollowUpDeliveryEnv, WordOfDayScheduledEnv {}

type FollowUpMessage = {
  token?: string;
  task?: FollowUpTask;
};

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

export async function handleQueueBatch(
  batch: MessageBatch<FollowUpMessage>,
  env: CloudflareHandlerEnv,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const task = message.body.task;
      if (task?.commandName === WOTD_COMMAND_NAME) {
        await postWordOfDayMessage(env, new Date());
        message.ack();
        continue;
      }

      const token = message.body.token;
      if (!token) {
        throw new Error('Follow-up queue message missing interaction token');
      }

      await executeAndDeliverFollowUp(task, { messageId: message.id, token }, env);
      message.ack();
    } catch (error) {
      console.error('Follow-up queue message processing failed', {
        messageId: message.id,
        error: describeError(error),
      });
      message.retry();
    }
  }
}

export async function runScheduled(
  controller: ScheduledController,
  env: WordOfDayScheduledEnv,
): Promise<void> {
  let firstError: unknown = null;
  const activities: Array<{ name: string; run: (c: ScheduledController, e: WordOfDayScheduledEnv) => Promise<void> }> = [
    { name: 'word-of-day', run: runWordOfDayScheduledActivity },
  ];

  for (const activity of activities) {
    try {
      await activity.run(controller, env);
    } catch (error) {
      console.error('Scheduled activity failed', {
        activity: activity.name,
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
        error: describeError(error),
      });
      if (!firstError) {
        firstError = error;
      }
    }
  }

  if (firstError) {
    if (firstError instanceof Error) {
      throw firstError;
    }
    throw new Error(`Scheduled activity failed: ${JSON.stringify(describeError(firstError))}`);
  }
}
