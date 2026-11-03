-- Playoffs are optional and independent of regular fixtures and goal records.
ALTER TABLE league_rules ADD COLUMN IF NOT EXISTS playoffs_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE league_rules ADD COLUMN IF NOT EXISTS playoffs_qualifiers INTEGER NOT NULL DEFAULT 4 CHECK (playoffs_qualifiers IN (2,4,8));
ALTER TABLE league_rules ADD COLUMN IF NOT EXISTS playoffs_third_place BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS playoff_brackets (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL UNIQUE REFERENCES leagues(id) ON DELETE CASCADE,
  qualifiers INTEGER NOT NULL CHECK (qualifiers IN (2,4,8)),
  third_place BOOLEAN NOT NULL DEFAULT FALSE CHECK (NOT third_place OR qualifiers > 2),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id,league_id)
);
CREATE TABLE IF NOT EXISTS playoff_entries (
  bracket_id INTEGER NOT NULL,
  league_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  seed INTEGER NOT NULL CHECK (seed BETWEEN 1 AND 8),
  PRIMARY KEY (bracket_id,team_id),
  UNIQUE (bracket_id,seed),
  FOREIGN KEY (bracket_id,league_id) REFERENCES playoff_brackets(id,league_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id,league_id) REFERENCES teams(id,league_id)
);
CREATE TABLE IF NOT EXISTS playoff_matches (
  id SERIAL PRIMARY KEY,
  bracket_id INTEGER NOT NULL,
  league_id INTEGER NOT NULL,
  round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 3),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  kind TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main','third')),
  home_team_id INTEGER,
  away_team_id INTEGER,
  home_score INTEGER,
  away_score INTEGER,
  winner_id INTEGER,
  penalty_winner_id INTEGER,
  UNIQUE (bracket_id,round,position,kind),
  FOREIGN KEY (bracket_id,league_id) REFERENCES playoff_brackets(id,league_id) ON DELETE CASCADE,
  FOREIGN KEY (bracket_id,home_team_id) REFERENCES playoff_entries(bracket_id,team_id),
  FOREIGN KEY (bracket_id,away_team_id) REFERENCES playoff_entries(bracket_id,team_id),
  CHECK (home_team_id IS NULL OR away_team_id IS NULL OR home_team_id <> away_team_id),
  CHECK (
    (home_score IS NULL AND away_score IS NULL AND winner_id IS NULL AND penalty_winner_id IS NULL)
    OR (home_score IS NOT NULL AND away_score IS NOT NULL AND home_score BETWEEN 0 AND 99 AND away_score BETWEEN 0 AND 99
      AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL AND winner_id IS NOT NULL
      AND ((home_score > away_score AND winner_id=home_team_id AND penalty_winner_id IS NULL)
        OR (away_score > home_score AND winner_id=away_team_id AND penalty_winner_id IS NULL)
        OR (home_score=away_score AND penalty_winner_id IS NOT NULL AND winner_id=penalty_winner_id AND winner_id IN (home_team_id,away_team_id))))
  )
);
CREATE INDEX IF NOT EXISTS idx_playoff_matches_league ON playoff_matches(league_id,bracket_id);
