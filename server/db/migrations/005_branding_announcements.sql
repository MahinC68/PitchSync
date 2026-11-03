-- Additive league identity and publication data. Existing rows remain untouched.
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS logo_key TEXT
  CHECK (logo_key IS NULL OR logo_key ~ '^[a-f0-9]{32}\.webp$');

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 5000),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_league_publication
  ON announcements(league_id,published_at DESC,id DESC);
