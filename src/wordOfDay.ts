const WORD_OF_DAY_MAX_MESSAGE_LENGTH = 2000;
const SECTION_SEPARATOR = '\n';

export const WORD_OF_DAY_DEFAULT_FEED_URL = 'https://www.merriam-webster.com/wotd/feed/rss2';

export interface WordOfDayEntry {
  word: string;
  pronunciation: string | null;
  shortDefinition: string;
  link: string;
}

function stripCdata(value: string): string {
  return value
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (fullMatch: string, codePoint: string) => {
      const parsed = Number.parseInt(codePoint, 10);
      if (Number.isNaN(parsed)) {
        return fullMatch;
      }
      return String.fromCodePoint(parsed);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (fullMatch: string, hexCodePoint: string) => {
      const parsed = Number.parseInt(hexCodePoint, 16);
      if (Number.isNaN(parsed)) {
        return fullMatch;
      }
      return String.fromCodePoint(parsed);
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function toPlainText(value: string): string {
  const withBreaks = value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*p\b[^>]*>/gi, '\n')
    .replace(/<\s*\/div\s*>/gi, '\n')
    .replace(/<\s*div\b[^>]*>/gi, '\n')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n- ');

  const withoutTags = withBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\\\/g, '\\');

  return decodeHtmlEntities(withoutTags)
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getTagContent(block: string, tagName: string): string | null {
  const escapedTagName = tagName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`<${escapedTagName}[^>]*>([\\s\\S]*?)<\\/${escapedTagName}>`, 'i');
  const match = regex.exec(block);
  if (!match) {
    return null;
  }

  return stripCdata(match[1]);
}

function getFirstItem(xml: string): string | null {
  const match = /<item\b[^>]*>([\s\S]*?)<\/item>/i.exec(xml);
  return match ? match[1] : null;
}

function normalizePronunciation(pronunciation: string): string {
  const trimmed = pronunciation.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('\\') && trimmed.endsWith('\\')) {
    return trimmed;
  }

  return `\\${trimmed.replace(/^\\+|\\+$/g, '')}\\`;
}

function extractPronunciation(item: string): string | null {
  const summary = getTagContent(item, 'itunes:summary');
  if (summary) {
    const plainSummary = toPlainText(summary);
    const summaryPronunciation = /\\([^\\\n]+)\\/.exec(plainSummary);
    if (summaryPronunciation) {
      return normalizePronunciation(summaryPronunciation[1]);
    }
  }

  const description = getTagContent(item, 'description');
  if (!description) {
    return null;
  }

  const plainDescription = toPlainText(description);
  const descriptionPronunciation = /\\([^\\\n]+)\\/.exec(plainDescription);
  return descriptionPronunciation ? normalizePronunciation(descriptionPronunciation[1]) : null;
}

export function parseWordOfDayFeed(xml: string): WordOfDayEntry {
  const item = getFirstItem(xml);
  if (!item) {
    throw new Error('No item found in word-of-day feed');
  }

  const rawWord = getTagContent(item, 'title');
  const rawLink = getTagContent(item, 'link');
  const rawShortDef = getTagContent(item, 'merriam:shortdef');

  const word = rawWord ? toPlainText(rawWord) : '';
  const link = rawLink ? toPlainText(rawLink) : '';
  const shortDefinition = rawShortDef ? toPlainText(rawShortDef) : '';

  if (!word) {
    throw new Error('Word-of-day item missing title');
  }

  if (!link) {
    throw new Error('Word-of-day item missing link');
  }

  if (!shortDefinition) {
    throw new Error('Word-of-day item missing short definition');
  }

  return {
    word,
    pronunciation: extractPronunciation(item),
    shortDefinition,
    link,
  };
}

export async function fetchWordOfDayEntry(feedUrl: string): Promise<WordOfDayEntry> {
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch word-of-day feed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  return parseWordOfDayFeed(xml);
}

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
