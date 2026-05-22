import type { KVNamespace, ScheduledController } from '@cloudflare/workers-types';
import {
  formatWordOfDayMessage,
  type WordOfDayEntry,
} from './wordOfDay.js';

const WORD_OF_DAY_POST_HOUR = 7;
const WORD_OF_DAY_POST_MINUTE = 30;

export interface WordOfDayScheduledTestDoubleEnv {
  WORD_OF_DAY_CHANNEL_ID?: string;
  TEST_FOLLOWUPS?: KVNamespace;
}

const TEST_DOUBLE_WORD_OF_DAY_ENTRY: WordOfDayEntry = {
  word: 'serendipity',
  pronunciation: '\\ser-uhn-DIP-uh-tee\\',
  shortDefinition: 'The faculty of finding valuable or agreeable things not sought for.',
  link: 'https://www.merriam-webster.com/word-of-the-day/',
};

function getEasternScheduleParts(scheduledTime: number): {
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(scheduledTime));
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    hour: Number.parseInt(byType.get('hour') ?? '0', 10),
    minute: Number.parseInt(byType.get('minute') ?? '0', 10),
  };
}

async function storeChannelPost(
  env: WordOfDayScheduledTestDoubleEnv,
  channelId: string,
  body: string,
): Promise<void> {
  if (!env.TEST_FOLLOWUPS) {
    throw new Error('TEST_FOLLOWUPS is required for the scheduled test double');
  }

  await env.TEST_FOLLOWUPS.put(
    `channel-post:${channelId}`,
    JSON.stringify({
      method: 'POST',
      path: `/__test/discord/api/v10/channels/${channelId}/messages`,
      body,
      receivedAt: new Date().toISOString(),
      channelId,
    }),
    { expirationTtl: 300 },
  );
}

export async function runWordOfDayScheduledTestDouble(
  controller: ScheduledController,
  env: WordOfDayScheduledTestDoubleEnv,
): Promise<void> {
  if (!env.WORD_OF_DAY_CHANNEL_ID) {
    console.warn('Word-of-day scheduled test double skipped because channel id is missing');
    return;
  }

  const scheduleParts = getEasternScheduleParts(controller.scheduledTime);
  if (scheduleParts.hour !== WORD_OF_DAY_POST_HOUR || scheduleParts.minute !== WORD_OF_DAY_POST_MINUTE) {
    console.log('Word-of-day scheduled test double skipped due to non-target local time', {
      cron: controller.cron,
      scheduledTime: controller.scheduledTime,
      localHour: scheduleParts.hour,
      localMinute: scheduleParts.minute,
    });
    return;
  }

  const content = formatWordOfDayMessage(TEST_DOUBLE_WORD_OF_DAY_ENTRY, new Date(controller.scheduledTime));

  await storeChannelPost(env, env.WORD_OF_DAY_CHANNEL_ID, JSON.stringify({
    content,
    allowed_mentions: {
      parse: [],
    },
  }));

  console.log('Word-of-day scheduled test double recorded channel post', {
    cron: controller.cron,
    scheduledTime: controller.scheduledTime,
    channelId: env.WORD_OF_DAY_CHANNEL_ID,
    word: TEST_DOUBLE_WORD_OF_DAY_ENTRY.word,
  });
}
