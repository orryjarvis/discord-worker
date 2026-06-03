import type { ScheduledController } from '@cloudflare/workers-types';
import { describeError } from './skills/ai.js';
import { runWordOfDayScheduledActivity, type WordOfDayScheduledEnv } from './wordOfDaySchedule.js';

export type ScheduledActivityEnv = WordOfDayScheduledEnv;

type ScheduledActivity = {
  name: string;
  run: (controller: ScheduledController, env: ScheduledActivityEnv) => Promise<void>;
};

const scheduledActivities: readonly ScheduledActivity[] = [
  {
    name: 'word-of-day',
    run: runWordOfDayScheduledActivity,
  },
];

export async function runScheduledActivities(
  controller: ScheduledController,
  env: ScheduledActivityEnv,
): Promise<void> {
  let firstError: unknown = null;

  for (const activity of scheduledActivities) {
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
