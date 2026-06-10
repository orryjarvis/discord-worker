import { describe, expect, it } from 'vitest';
import { parseReleaseSubcommand, toReleaseSetPayload } from '@/commands/release';
import { formatReleaseList, validateReleaseDateParts } from '@/skills/releases';

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

  it('accepts TBD and full dates', () => {
    expect(validateReleaseDateParts({ year: null, quarter: null, month: null, day: null })).toBeNull();
    expect(validateReleaseDateParts({ year: 2027, quarter: null, month: 11, day: 20 })).toBeNull();
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
