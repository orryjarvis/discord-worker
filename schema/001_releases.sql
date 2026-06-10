CREATE TABLE IF NOT EXISTS releases (
  title_normalized TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  year INTEGER,
  quarter INTEGER,
  month INTEGER,
  day INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_releases_date_parts
  ON releases (year, quarter, month, day);
