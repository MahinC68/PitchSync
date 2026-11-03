-- Existing rosters and goal attribution are retained. NULL means unlimited.
ALTER TABLE league_rules ADD COLUMN IF NOT EXISTS max_roster_size INTEGER
  CHECK (max_roster_size IS NULL OR max_roster_size BETWEEN 1 AND 1000);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_key TEXT
  CHECK (logo_key IS NULL OR logo_key ~ '^[a-f0-9]{32}\.webp$');
