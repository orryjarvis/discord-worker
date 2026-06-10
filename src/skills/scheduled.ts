import type { D1Database } from '@cloudflare/workers-types';
import { listScheduledMessages, type ScheduledMessageRecord } from '@/integrations/scheduledMessages';

export interface ScheduledStoreEnv {
  RELEASES_DB: D1Database;
}

function formatScheduleType(record: ScheduledMessageRecord): string {
  return record.scheduleType === 'reminder' ? 'reminder' : 'release';
}

function formatScheduleTime(scheduledFor: number): string {
  return new Date(scheduledFor).toISOString();
}

function summarizeStatusCounts(records: ScheduledMessageRecord[]): string {
  const counts = {
    scheduled: 0,
    firing: 0,
    fired: 0,
    canceled: 0,
  };

  for (const record of records) {
    counts[record.status] += 1;
  }

  return `scheduled=${counts.scheduled}, firing=${counts.firing}, fired=${counts.fired}, canceled=${counts.canceled}`;
}

export function formatScheduledList(records: ScheduledMessageRecord[]): string {
  if (!records.length) {
    return 'Scheduled metadata\nNo scheduled messages found.';
  }

  const lines = records.map((record) => {
    return `- ${record.scheduleKey} | ${formatScheduleType(record)} | ${record.status} | at ${formatScheduleTime(record.scheduledFor)} | attempts=${record.attempts} | channel=${record.channelId}`;
  });

  return [
    'Scheduled metadata',
    `Status counts: ${summarizeStatusCounts(records)}`,
    'Entries:',
    ...lines,
  ].join('\n');
}

export async function listScheduledMetadata(
  env: ScheduledStoreEnv,
  limit = 20,
): Promise<ScheduledMessageRecord[]> {
  return listScheduledMessages(env.RELEASES_DB, limit);
}
