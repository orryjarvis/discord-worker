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
  firingStartedAt: string | null;
  nextAttemptAt: number | null;
  lastError: string | null;
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
  firingStartedAt?: string | null;
  nextAttemptAt?: number | null;
  lastError?: string | null;
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
  firing_started_at: string | null;
  next_attempt_at: number | null;
  last_error: string | null;
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
    firingStartedAt: row.firing_started_at,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
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
      firing_started_at,
      next_attempt_at,
      last_error,
      fired_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(schedule_key) DO UPDATE SET
      schedule_type = excluded.schedule_type,
      source_key = excluded.source_key,
      channel_id = excluded.channel_id,
      scheduled_for = excluded.scheduled_for,
      content = excluded.content,
      allowed_mentions_json = excluded.allowed_mentions_json,
      status = excluded.status,
      attempts = excluded.attempts,
      firing_started_at = excluded.firing_started_at,
      next_attempt_at = excluded.next_attempt_at,
      last_error = excluded.last_error,
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
    input.firingStartedAt ?? null,
    input.nextAttemptAt ?? null,
    input.lastError ?? null,
    input.firedAt ?? null,
  ).run();
}

export async function listPendingScheduledMessages(
  db: D1Database,
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
      firing_started_at,
      next_attempt_at,
      last_error,
      fired_at,
      created_at,
      updated_at
    FROM scheduled_messages
    WHERE status = 'scheduled'
    ORDER BY scheduled_for ASC, schedule_key ASC`,
  ).all<ScheduledMessageRow>();

  return (result.results ?? []).map(toScheduledMessageRecord);
}

export async function getNextPendingScheduledMessage(
  db: D1Database,
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
      firing_started_at,
      next_attempt_at,
      last_error,
      fired_at,
      created_at,
      updated_at
    FROM scheduled_messages
    WHERE status = 'scheduled'
    ORDER BY scheduled_for ASC, schedule_key ASC
    LIMIT 1`,
  ).all<ScheduledMessageRow>();

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
      firing_started_at = NULL,
      next_attempt_at = NULL,
      last_error = 'canceled',
      updated_at = CURRENT_TIMESTAMP
    WHERE schedule_key = ? AND status != 'fired'`,
  ).bind(scheduleKey).run();
}

export async function listDueScheduledMessages(
  db: D1Database,
  nowMs = Date.now(),
  limit = 25,
): Promise<ScheduledMessageRecord[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
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
      firing_started_at,
      next_attempt_at,
      last_error,
      fired_at,
      created_at,
      updated_at
    FROM scheduled_messages
    WHERE status = 'scheduled' AND scheduled_for <= ?
    ORDER BY scheduled_for ASC, schedule_key ASC
    LIMIT ?`,
  ).bind(nowMs, safeLimit).all<ScheduledMessageRow>();

  return (result.results ?? []).map(toScheduledMessageRecord);
}

export async function tryMarkScheduledMessageFiring(
  db: D1Database,
  scheduleKey: string,
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE scheduled_messages
    SET status = 'firing',
      firing_started_at = CURRENT_TIMESTAMP,
      attempts = attempts + 1,
      next_attempt_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE schedule_key = ? AND status = 'scheduled'`,
  ).bind(scheduleKey).run();

  return Number(result.meta.changes ?? 0) > 0;
}

export async function markScheduledMessageFired(
  db: D1Database,
  scheduleKey: string,
  firedAtIso: string,
): Promise<void> {
  await db.prepare(
    `UPDATE scheduled_messages
    SET status = 'fired',
      fired_at = ?,
      firing_started_at = NULL,
      next_attempt_at = NULL,
      last_error = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE schedule_key = ? AND status = 'firing'`,
  ).bind(firedAtIso, scheduleKey).run();
}

export async function resetScheduledMessageToScheduled(
  db: D1Database,
  scheduleKey: string,
  lastError?: string | null,
): Promise<void> {
  await db.prepare(
    `UPDATE scheduled_messages
    SET status = 'scheduled',
      firing_started_at = NULL,
      next_attempt_at = NULL,
      last_error = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE schedule_key = ? AND status = 'firing'`,
  ).bind(lastError ?? null, scheduleKey).run();
}

export async function reclaimStaleFiringScheduledMessages(
  db: D1Database,
  nowMs = Date.now(),
  leaseMs = 5 * 60 * 1000,
): Promise<number> {
  const result = await db.prepare(
    `UPDATE scheduled_messages
    SET status = 'scheduled',
      firing_started_at = NULL,
      next_attempt_at = NULL,
      last_error = COALESCE(last_error, 'reclaimed after stale lease'),
      updated_at = CURRENT_TIMESTAMP
    WHERE status = 'firing'
      AND firing_started_at IS NOT NULL
      AND (strftime('%s', firing_started_at) * 1000 + ?) <= ?`,
  ).bind(leaseMs, nowMs).run();

  return Number(result.meta.changes ?? 0);
}

export async function listScheduledMessages(
  db: D1Database,
  limit = 20,
): Promise<ScheduledMessageRecord[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
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
      firing_started_at,
      next_attempt_at,
      last_error,
      fired_at,
      created_at,
      updated_at
    FROM scheduled_messages
    ORDER BY scheduled_for ASC, schedule_key ASC
    LIMIT ?`,
  ).bind(safeLimit).all<ScheduledMessageRow>();

  return (result.results ?? []).map(toScheduledMessageRecord);
}
