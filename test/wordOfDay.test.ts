import { describe, expect, it } from 'vitest';
import { formatWordOfDayMessage, parseWordOfDayFeed } from '../src/wordOfDay.js';

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:merriam="https://www.merriam-webster.com/word-of-the-day" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
  <channel>
    <item>
      <title><![CDATA[ fraught ]]></title>
      <link><![CDATA[ https://www.merriam-webster.com/word-of-the-day/fraught-2026-05-22 ]]></link>
      <description><![CDATA[<p><strong>fraught</strong> &#149; \\FRAWT\\ &#149; <em>adjective</em></p>]]></description>
      <itunes:summary><![CDATA[ Merriam-Webster's Word of the Day for May 22, 2026 is: fraught \\FRAWT\\ adjective ]]></itunes:summary>
      <merriam:shortdef><![CDATA[ causing or involving a lot of emotional stress or worry ]]></merriam:shortdef>
    </item>
  </channel>
</rss>`;

describe('word-of-day feed parser', () => {
  it('extracts normalized word, pronunciation, short definition, and link', () => {
    const parsed = parseWordOfDayFeed(SAMPLE_FEED);

    expect(parsed).toEqual({
      word: 'fraught',
      pronunciation: '\\FRAWT\\',
      shortDefinition: 'causing or involving a lot of emotional stress or worry',
      link: 'https://www.merriam-webster.com/word-of-the-day/fraught-2026-05-22',
    });
  });

  it('formats discord message with eastern date and no html artifacts', () => {
    const parsed = parseWordOfDayFeed(SAMPLE_FEED);
    const message = formatWordOfDayMessage(parsed, new Date('2026-05-22T11:30:00.000Z'));

    expect(message).toContain('Word of the Day');
    expect(message).toContain('May 22, 2026');
    expect(message).toContain('**fraught** (\\FRAWT\\)');
    expect(message).toContain('causing or involving a lot of emotional stress or worry');
    expect(message).toContain('https://www.merriam-webster.com/word-of-the-day/fraught-2026-05-22');
    expect(message).not.toContain('<p>');
    expect(message.length).toBeLessThanOrEqual(2000);
  });
});
