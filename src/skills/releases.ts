import {
  listReleaseRecords,
  upsertReleaseRecord,
  type ReleaseRecord,
} from '@/integrations/releases';
import type { D1Database } from '@cloudflare/workers-types';

export interface ReleaseStoreEnv {
  RELEASES_DB: D1Database;
}

export interface ReleaseDateParts {
  year: number | null;
  quarter: number | null;
  month: number | null;
  day: number | null;
}

export interface UpsertReleaseRequest extends ReleaseDateParts {
  title: string;
  titleNormalized: string;
  channelId: string;
}

export function normalizeReleaseTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function validateReleaseDateParts(parts: ReleaseDateParts): string | null {
  const { year, quarter, month, day } = parts;

  if (year !== null && (!Number.isInteger(year) || year < 1970 || year > 3000)) {
    return 'Year must be between 1970 and 3000.';
  }

  if (quarter !== null && (!Number.isInteger(quarter) || quarter < 1 || quarter > 4)) {
    return 'Quarter must be between 1 and 4.';
  }

  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return 'Month must be between 1 and 12.';
  }

  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
    return 'Day must be between 1 and 31.';
  }

  if (quarter !== null && month !== null) {
    return 'Quarter and month cannot be used together.';
  }

  if (day !== null && month === null) {
    return 'Day requires a month.';
  }

  if ((month !== null || quarter !== null || day !== null) && year === null) {
    return 'Year is required when quarter, month, or day is provided.';
  }

  if (day !== null && month !== null && year !== null) {
    const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > maxDay) {
      return 'Day is invalid for the provided month/year.';
    }
  }

  return null;
}

export function hasExactReleaseDate(parts: ReleaseDateParts): boolean {
  return parts.year !== null && parts.month !== null && parts.day !== null;
}

export function toExactReleaseDate(parts: ReleaseDateParts): Date | null {
  if (!hasExactReleaseDate(parts)) {
    return null;
  }

  return new Date(Date.UTC(parts.year as number, (parts.month as number) - 1, parts.day as number, 12, 0, 0, 0));
}

function formatReleaseDate(record: ReleaseRecord): string {
  if (record.year === null) {
    return 'TBD';
  }

  if (record.month !== null && record.day !== null) {
    const date = new Date(Date.UTC(record.year, record.month - 1, record.day, 12, 0, 0, 0));
    return date.toISOString().slice(0, 10);
  }

  if (record.quarter !== null) {
    return `Q${record.quarter} ${record.year}`;
  }

  if (record.month !== null) {
    return `${record.year}-${String(record.month).padStart(2, '0')}`;
  }

  return String(record.year);
}

function classifyRelease(record: ReleaseRecord, nowMs: number): 'upcoming' | 'past' | 'tbd' {
  const exactDate = toExactReleaseDate({
    year: record.year,
    quarter: null,
    month: record.month,
    day: record.day,
  });

  if (!exactDate) {
    return 'tbd';
  }

  return exactDate.getTime() >= nowMs ? 'upcoming' : 'past';
}

function sortByExactDateAscending(a: ReleaseRecord, b: ReleaseRecord): number {
  const aDate = toExactReleaseDate({ year: a.year, quarter: null, month: a.month, day: a.day });
  const bDate = toExactReleaseDate({ year: b.year, quarter: null, month: b.month, day: b.day });
  if (!aDate || !bDate) {
    return a.title.localeCompare(b.title);
  }

  return aDate.getTime() - bDate.getTime() || a.title.localeCompare(b.title);
}

function sortByExactDateDescending(a: ReleaseRecord, b: ReleaseRecord): number {
  return sortByExactDateAscending(b, a);
}

function formatReleaseLine(record: ReleaseRecord): string {
  return `- ${record.title}: ${formatReleaseDate(record)}`;
}

function buildSection(title: string, records: ReleaseRecord[]): string {
  const lines = records.length
    ? records.map(formatReleaseLine)
    : ['- None'];

  return `${title}\n${lines.join('\n')}`;
}

export function formatReleaseList(records: ReleaseRecord[], nowMs = Date.now()): string {
  const upcoming: ReleaseRecord[] = [];
  const past: ReleaseRecord[] = [];
  const tbd: ReleaseRecord[] = [];

  for (const record of records) {
    const group = classifyRelease(record, nowMs);
    if (group === 'upcoming') {
      upcoming.push(record);
    } else if (group === 'past') {
      past.push(record);
    } else {
      tbd.push(record);
    }
  }

  upcoming.sort(sortByExactDateAscending);
  past.sort(sortByExactDateDescending);
  tbd.sort((a, b) => a.title.localeCompare(b.title));

  return [
    buildSection('Upcoming releases', upcoming),
    buildSection('Past releases', past),
    buildSection('TBD', tbd),
  ].join('\n\n');
}

export async function listReleases(env: ReleaseStoreEnv): Promise<ReleaseRecord[]> {
  return listReleaseRecords(env.RELEASES_DB);
}

export async function upsertRelease(
  env: ReleaseStoreEnv,
  request: UpsertReleaseRequest,
): Promise<void> {
  await upsertReleaseRecord(env.RELEASES_DB, {
    titleNormalized: request.titleNormalized,
    title: request.title,
    channelId: request.channelId,
    year: request.year,
    quarter: request.quarter,
    month: request.month,
    day: request.day,
  });
}
