import type { KVNamespace, ScheduledController } from '@cloudflare/workers-types';
import {
  fetchWordOfDayEntry,
  formatWordOfDayMessage,
  WORD_OF_DAY_DEFAULT_FEED_URL,
} from './wordOfDay.js';
import { sendDiscordMessage } from './skills/sendDiscordMessage.js';

const WORD_OF_DAY_POST_HOUR = 7;
const WORD_OF_DAY_POST_MINUTE = 30;

export interface WordOfDayScheduledEnv {
  DISCORD_TOKEN: string;
  DISCORD_API_BASE_URL?: string;
  WORD_OF_DAY_CHANNEL_ID?: string;
  WORD_OF_DAY_FEED_URL?: string;
  KV: KVNamespace;
}

export type WordOfDayPostEnv = Pick<WordOfDayScheduledEnv,
  'DISCORD_TOKEN' | 'DISCORD_API_BASE_URL' | 'WORD_OF_DAY_CHANNEL_ID' | 'WORD_OF_DAY_FEED_URL'>;

export async function postWordOfDayMessage(
  env: WordOfDayPostEnv,
  scheduledTime: Date,
): Promise<{ word: string; channelId: string }> {
  const channelId = env.WORD_OF_DAY_CHANNEL_ID;
  if (!channelId) {
    throw new Error('Word-of-day posting failed because channel id is missing');
  }

  const feedUrl = env.WORD_OF_DAY_FEED_URL ?? WORD_OF_DAY_DEFAULT_FEED_URL;
  const wordOfDay = await fetchWordOfDayEntry(feedUrl);
  const content = formatWordOfDayMessage(wordOfDay, scheduledTime);

  await sendDiscordMessage(
    {
      channelId,
      content,
      allowedMentions: {
        parse: [],
      },
      failurePrefix: 'Failed to post word-of-day message',
    },
    env,
  );

  return {
    word: wordOfDay.word,
    channelId,
  };
}

function getEasternScheduleParts(scheduledTime: number): {
  hour: number;
  minute: number;
  dateKey: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date(scheduledTime));
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    hour: Number.parseInt(byType.get('hour') ?? '0', 10),
    minute: Number.parseInt(byType.get('minute') ?? '0', 10),
    dateKey: `${byType.get('year') ?? '0000'}-${byType.get('month') ?? '00'}-${byType.get('day') ?? '00'}`,
  };
}

export async function runWordOfDayScheduledActivity(
  controller: ScheduledController,
  env: WordOfDayScheduledEnv,
): Promise<void> {
  if (!env.WORD_OF_DAY_CHANNEL_ID) {
    console.warn('Word-of-day schedule skipped because channel id is missing');
    return;
  }

  const scheduleParts = getEasternScheduleParts(controller.scheduledTime);
  if (scheduleParts.hour !== WORD_OF_DAY_POST_HOUR || scheduleParts.minute !== WORD_OF_DAY_POST_MINUTE) {
    return;
  }

  const dedupeKey = `word-of-day:posted:${scheduleParts.dateKey}`;
  const alreadyPosted = await env.KV.get(dedupeKey);
  if (alreadyPosted) {
    return;
  }

  const result = await postWordOfDayMessage(env, new Date(controller.scheduledTime));

  await env.KV.put(
    dedupeKey,
    JSON.stringify({
      postedAt: new Date().toISOString(),
      word: result.word,
      channelId: result.channelId,
    }),
    { expirationTtl: 60 * 60 * 24 * 14 },
  );
}
