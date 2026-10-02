ALTER TABLE scheduled_messages
  ADD COLUMN firing_started_at TEXT;

ALTER TABLE scheduled_messages
  ADD COLUMN next_attempt_at INTEGER;

ALTER TABLE scheduled_messages
  ADD COLUMN last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_firing_started_at
  ON scheduled_messages (status, firing_started_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_next_attempt_at
  ON scheduled_messages (status, next_attempt_at);
