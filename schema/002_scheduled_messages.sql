CREATE TABLE IF NOT EXISTS scheduled_messages (
  schedule_key TEXT PRIMARY KEY,
  schedule_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  scheduled_for INTEGER NOT NULL,
  content TEXT NOT NULL,
  allowed_mentions_json TEXT NOT NULL DEFAULT '{"parse":[]}',
  status TEXT NOT NULL DEFAULT 'scheduled',
  attempts INTEGER NOT NULL DEFAULT 0,
  fired_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (schedule_type IN ('reminder', 'release')),
  CHECK (status IN ('scheduled', 'firing', 'fired', 'canceled'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_scheduled_for
  ON scheduled_messages (status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_type_source
  ON scheduled_messages (schedule_type, source_key);

INSERT OR IGNORE INTO scheduled_messages (
  schedule_key,
  schedule_type,
  source_key,
  channel_id,
  scheduled_for,
  content,
  allowed_mentions_json,
  status
)
SELECT
  'release:' || title_normalized,
  'release',
  title_normalized,
  channel_id,
  CAST(unixepoch(datetime(
    printf('%04d-%02d-%02d 12:00:00', year, month, day),
    '-7 days'
  )) * 1000 AS INTEGER),
  'Upcoming release hype: **' || title || '** is scheduled for ' || printf('%04d-%02d-%02d', year, month, day) || '.',
  '{"parse":[]}',
  'scheduled'
FROM releases
WHERE year IS NOT NULL
  AND month IS NOT NULL
  AND day IS NOT NULL;
