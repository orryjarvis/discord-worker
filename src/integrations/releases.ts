import type { D1Database } from '@cloudflare/workers-types';

export interface ReleaseRecord {
  titleNormalized: string;
  title: string;
  channelId: string;
  year: number | null;
  quarter: number | null;
  month: number | null;
  day: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertReleaseInput {
  titleNormalized: string;
  title: string;
  channelId: string;
  year: number | null;
  quarter: number | null;
  month: number | null;
  day: number | null;
}

type ReleaseRow = {
  title_normalized: string;
  title: string;
  channel_id: string;
  year: number | null;
  quarter: number | null;
  month: number | null;
  day: number | null;
  created_at: string;
  updated_at: string;
};

function toReleaseRecord(row: ReleaseRow): ReleaseRecord {
  return {
    titleNormalized: row.title_normalized,
    title: row.title,
    channelId: row.channel_id,
    year: row.year,
    quarter: row.quarter,
    month: row.month,
    day: row.day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertReleaseRecord(
  db: D1Database,
  input: UpsertReleaseInput,
): Promise<void> {
  await db.prepare(
    `INSERT INTO releases (
      title_normalized,
      title,
      channel_id,
      year,
      quarter,
      month,
      day
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(title_normalized) DO UPDATE SET
      title = excluded.title,
      channel_id = excluded.channel_id,
      year = excluded.year,
      quarter = excluded.quarter,
      month = excluded.month,
      day = excluded.day,
      updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    input.titleNormalized,
    input.title,
    input.channelId,
    input.year,
    input.quarter,
    input.month,
    input.day,
  ).run();
}

export async function listReleaseRecords(db: D1Database): Promise<ReleaseRecord[]> {
  const result = await db.prepare(
    `SELECT
      title_normalized,
      title,
      channel_id,
      year,
      quarter,
      month,
      day,
      created_at,
      updated_at
    FROM releases`,
  ).all<ReleaseRow>();

  return (result.results ?? []).map(toReleaseRecord);
}
