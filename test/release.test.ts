import { describe, expect, it } from 'vitest';
import { parseReleaseSubcommand, toReleaseSetPayload } from '@/commands/release';
import {
  buildReleaseScheduledMessage,
  formatReleaseList,
  validateReleaseDateParts,
} from '@/skills/releases';

describe('release command parsing', () => {
  it('parses supported subcommands', () => {
    expect(parseReleaseSubcommand('set')).toBe('set');
    expect(parseReleaseSubcommand('list')).toBe('list');
    expect(parseReleaseSubcommand('other')).toBeNull();
  });

  it('builds set payload from slash options', () => {
    const payload = toReleaseSetPayload({
      title: 'Hades 2',
      year: 2027,
      month: 5,
      day: 11,
    }, 'channel-1');

    expect(payload).toEqual({
      action: 'set',
      channelId: 'channel-1',
      title: 'Hades 2',
      year: 2027,
      quarter: null,
      month: 5,
      day: 11,
    });
  });
});

describe('release validation', () => {
  it('rejects conflicting or incomplete date parts', () => {
    expect(validateReleaseDateParts({ year: 2027, quarter: 2, month: 5, day: null })).toBe(
      'Quarter and month cannot be used together.',
    );
    expect(validateReleaseDateParts({ year: null, quarter: 2, month: null, day: null })).toBe(
      'Year is required when quarter, month, or day is provided.',
    );
    expect(validateReleaseDateParts({ year: 2027, quarter: null, month: null, day: 5 })).toBe(
      'Day requires a month.',
    );
  });

  it('rejects out-of-range numeric date parts', () => {
    expect(validateReleaseDateParts({ year: 1969, quarter: null, month: null, day: null })).toBe(
      'Year must be between 1970 and 3000.',
    );
    expect(validateReleaseDateParts({ year: 2027, quarter: 0, month: null, day: null })).toBe(
      'Quarter must be between 1 and 4.',
    );
    expect(validateReleaseDateParts({ year: 2027, quarter: null, month: 13, day: null })).toBe(
      'Month must be between 1 and 12.',
    );
    expect(validateReleaseDateParts({ year: 2027, quarter: null, month: 5, day: 32 })).toBe(
      'Day must be between 1 and 31.',
    );
  });

  it('accepts TBD and full dates', () => {
    expect(validateReleaseDateParts({ year: null, quarter: null, month: null, day: null })).toBeNull();
    expect(validateReleaseDateParts({ year: 2027, quarter: null, month: 11, day: 20 })).toBeNull();
  });
});

describe('release scheduled message building', () => {
  it('builds a release schedule row from an exact date', () => {
    const scheduledMessage = buildReleaseScheduledMessage({
      title: 'Hades 2',
      titleNormalized: 'hades 2',
      channelId: 'channel-1',
      year: 2027,
      quarter: null,
      month: 2,
      day: 10,
    }, Date.UTC(2026, 0, 1, 0, 0, 0, 0));

    expect(scheduledMessage).toEqual({
      scheduleKey: 'release:hades 2',
      scheduleType: 'release',
      sourceKey: 'hades 2',
      channelId: 'channel-1',
      scheduledFor: Date.UTC(2027, 1, 3, 12, 0, 0, 0),
      content: 'Upcoming release hype: **Hades 2** is scheduled for 2027-02-10.',
      allowedMentionsJson: '{"parse":[]}',
    });
  });

  it('skips schedule rows for TBD releases', () => {
    expect(buildReleaseScheduledMessage({
      title: 'Mystery Game',
      titleNormalized: 'mystery game',
      channelId: 'channel-1',
      year: 2027,
      quarter: 1,
      month: null,
      day: null,
    })).toBeNull();
  });
});

describe('release list formatting', () => {
  it('groups upcoming, past, and tbd releases', () => {
    const now = Date.UTC(2026, 5, 9, 12, 0, 0, 0);
    const output = formatReleaseList([
      {
        titleNormalized: 'future game',
        title: 'Future Game',
        channelId: 'channel-1',
        year: 2027,
        quarter: null,
        month: 2,
        day: 10,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        titleNormalized: 'old game',
        title: 'Old Game',
        channelId: 'channel-1',
        year: 2024,
        quarter: null,
        month: 1,
        day: 20,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        titleNormalized: 'mystery game',
        title: 'Mystery Game',
        channelId: 'channel-1',
        year: 2028,
        quarter: 1,
        month: null,
        day: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ], now);

    expect(output).toContain('Upcoming releases');
    expect(output).toContain('Past releases');
    expect(output).toContain('TBD');
    expect(output).toContain('- Future Game: 2027-02-10');
    expect(output).toContain('- Old Game: 2024-01-20');
    expect(output).toContain('- Mystery Game: Q1 2028');
  });
});
