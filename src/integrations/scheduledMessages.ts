import type { D1Database } from '@cloudflare/workers-types';

export type ScheduledMessageType = 'reminder' | 'release';
export type ScheduledMessageStatus = 'scheduled' | 'firing' | 'fired' | 'canceled';

export interface ScheduledMessageRecord {
  scheduleKey: string;
  scheduleType: ScheduledMessageType;
  sourceKey: string;
  channelId: string;
  scheduledFor: number;
  content: string;
  allowedMentionsJson: string;
  status: ScheduledMessageStatus;
  attempts: number;
  firedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertScheduledMessageInput {
  scheduleKey: string;
  scheduleType: ScheduledMessageType;
  sourceKey: string;
  channelId: string;
  scheduledFor: number;
  content: string;
  allowedMentionsJson?: string;
  status?: ScheduledMessageStatus;
  attempts?: number;
  firedAt?: string | null;
}

type ScheduledMessageRow = {
  schedule_key: string;
  schedule_type: ScheduledMessageType;
  source_key: string;
  channel_id: string;
  scheduled_for: number;
  content: string;
  allowed_mentions_json: string;
  status: ScheduledMessageStatus;
  attempts: number;
  fired_at: string | null;
  created_at: string;
  updated_at: string;
};

function toScheduledMessageRecord(row: ScheduledMessageRow): ScheduledMessageRecord {
  return {
    scheduleKey: row.schedule_key,
    scheduleType: row.schedule_type,
    sourceKey: row.source_key,
    channelId: row.channel_id,
    scheduledFor: row.scheduled_for,
    content: row.content,
    allowedMentionsJson: row.allowed_mentions_json,
    status: row.status,
    attempts: row.attempts,
    firedAt: row.fired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertScheduledMessage(
  db: D1Database,
  input: UpsertScheduledMessageInput,
): Promise<void> {
  await db.prepare(
    `INSERT INTO scheduled_messages (
      schedule_key,
      schedule_type,
      source_key,
      channel_id,
      scheduled_for,
      content,
      allowed_mentions_json,
      status,
      attempts,
      fired_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(schedule_key) DO UPDATE SET
      schedule_type = excluded.schedule_type,
      source_key = excluded.source_key,
      channel_id = excluded.channel_id,
      scheduled_for = excluded.scheduled_for,
      content = excluded.content,
      allowed_mentions_json = excluded.allowed_mentions_json,
      status = excluded.status,
      attempts = excluded.attempts,
      fired_at = excluded.fired_at,
      updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    input.scheduleKey,
    input.scheduleType,
    input.sourceKey,
    input.channelId,
    input.scheduledFor,
    input.content,
    input.allowedMentionsJson ?? '{"parse":[]}',
    input.status ?? 'scheduled',
    input.attempts ?? 0,
    input.firedAt ?? null,
  ).run();
}

export async function listPendingScheduledMessages(
  db: D1Database,
  nowMs = Date.now(),
): Promise<ScheduledMessageRecord[]> {
  const result = await db.prepare(
    `SELECT
      schedule_key,
      schedule_type,
      source_key,
      channel_id,
      scheduled_for,
      content,
      allowed_mentions_json,
      status,
      attempts,
      fired_at,
      created_at,
      updated_at
    FROM scheduled_messages
    WHERE status = 'scheduled' AND scheduled_for >= ?
    ORDER BY scheduled_for ASC, schedule_key ASC`,
  ).bind(nowMs).all<ScheduledMessageRow>();

  return (result.results ?? []).map(toScheduledMessageRecord);
}

export async function getNextPendingScheduledMessage(
  db: D1Database,
  nowMs = Date.now(),
): Promise<ScheduledMessageRecord | null> {
  const result = await db.prepare(
    `SELECT
      schedule_key,
      schedule_type,
      source_key,
      channel_id,
      scheduled_for,
      content,
      allowed_mentions_json,
      status,
      attempts,
      fired_at,
      created_at,
      updated_at
    FROM scheduled_messages
    WHERE status = 'scheduled' AND scheduled_for >= ?
    ORDER BY scheduled_for ASC, schedule_key ASC
    LIMIT 1`,
  ).bind(nowMs).all<ScheduledMessageRow>();

  const row = result.results?.[0];
  return row ? toScheduledMessageRecord(row) : null;
}

export async function markScheduledMessageCanceled(
  db: D1Database,
  scheduleKey: string,
): Promise<void> {
  await db.prepare(
    `UPDATE scheduled_messages
    SET status = 'canceled',
      updated_at = CURRENT_TIMESTAMP
    WHERE schedule_key = ?`,
  ).bind(scheduleKey).run();
}
