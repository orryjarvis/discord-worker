import type { WordOfDayEntry } from '@/integrations/wordOfDay';

export {
  fetchWordOfDayEntry,
  parseWordOfDayFeed,
  WORD_OF_DAY_DEFAULT_FEED_URL,
  type WordOfDayEntry,
} from '@/integrations/wordOfDay';

const WORD_OF_DAY_MAX_MESSAGE_LENGTH = 2000;
const SECTION_SEPARATOR = '\n';

function formatEasternDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatWordOfDayMessage(entry: WordOfDayEntry, scheduledTime: Date): string {
  const lines = [
    `📚 **Word of the Day — ${formatEasternDateLabel(scheduledTime)}**`,
    entry.pronunciation
      ? `**${entry.word}** (${entry.pronunciation})`
      : `**${entry.word}**`,
    entry.shortDefinition,
    entry.link,
  ];

  const message = lines.join(SECTION_SEPARATOR).trim();
  if (message.length <= WORD_OF_DAY_MAX_MESSAGE_LENGTH) {
    return message;
  }

  const overflow = message.length - WORD_OF_DAY_MAX_MESSAGE_LENGTH;
  const clippedDefinitionLength = Math.max(0, entry.shortDefinition.length - overflow - 3);
  const clippedDefinition = clippedDefinitionLength > 0
    ? `${entry.shortDefinition.slice(0, clippedDefinitionLength).trimEnd()}...`
    : '...';

  return [
    `📚 **Word of the Day — ${formatEasternDateLabel(scheduledTime)}**`,
    entry.pronunciation
      ? `**${entry.word}** (${entry.pronunciation})`
      : `**${entry.word}**`,
    clippedDefinition,
    entry.link,
  ].join(SECTION_SEPARATOR);
}
