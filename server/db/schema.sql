-- ─── PitchSync Schema ────────────────────────────────────────────────────────
-- Run: psql $DATABASE_URL -f server/db/schema.sql

-- ── Leagues ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leagues (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        NOT NULL,
  access_code TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Admins ───────────────────────────────────────────────────────────────────
-- Accounts are independent of leagues; admin_leagues is authoritative.
CREATE TABLE IF NOT EXISTS admins (
  id                 SERIAL      PRIMARY KEY,
  email              TEXT        NOT NULL UNIQUE,
  password_hash      TEXT        NOT NULL,
  league_id          INTEGER     REFERENCES leagues(id) ON DELETE SET NULL,
  reset_token        TEXT,
  reset_token_expiry TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy admins.league_id is retained only for old seed scripts.
CREATE TABLE IF NOT EXISTS admin_leagues (
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_id, league_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_leagues_league_id ON admin_leagues(league_id);

-- ── Teams ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id         SERIAL      PRIMARY KEY,
  league_id  INTEGER     NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, name)
);

-- ── Players ───────────────────────────────────────────────────────────────────
-- Players have no accounts; they access data via the league access_code only.
CREATE TABLE IF NOT EXISTS players (
  id         SERIAL      PRIMARY KEY,
  team_id    INTEGER     NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
  league_id  INTEGER     NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Matches ───────────────────────────────────────────────────────────────────
-- home_score / away_score are NULL until the result is recorded.
CREATE TABLE IF NOT EXISTS matches (
  id           SERIAL  PRIMARY KEY,
  league_id    INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  home_score   INTEGER,
  away_score   INTEGER,
  date         DATE    NOT NULL,
  time         TIME    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled', 'completed')),
  CONSTRAINT different_teams CHECK (home_team_id <> away_team_id)
);

-- ── Goals ─────────────────────────────────────────────────────────────────────
-- team_id is stored denormalised for fast leaderboard queries.
CREATE TABLE IF NOT EXISTS goals (
  id        SERIAL  PRIMARY KEY,
  match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id   INTEGER NOT NULL REFERENCES teams(id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admins_league_id      ON admins(league_id);
CREATE INDEX IF NOT EXISTS idx_admins_reset_token    ON admins(reset_token)
  WHERE reset_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teams_league_id       ON teams(league_id);

CREATE INDEX IF NOT EXISTS idx_players_team_id       ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_league_id     ON players(league_id);

CREATE INDEX IF NOT EXISTS idx_matches_league_id     ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_league_status ON matches(league_id, status);

CREATE INDEX IF NOT EXISTS idx_goals_match_id        ON goals(match_id);
CREATE INDEX IF NOT EXISTS idx_goals_player_id       ON goals(player_id);
CREATE INDEX IF NOT EXISTS idx_goals_team_id         ON goals(team_id);

-- Phase 2: fresh-install league rules and forfeit metadata.
-- Additive: original match scores and goal records are never rewritten.
CREATE TABLE IF NOT EXISTS league_rules (
  league_id INTEGER PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  win_points INTEGER NOT NULL DEFAULT 3 CHECK (win_points BETWEEN -100 AND 100),
  draw_points INTEGER NOT NULL DEFAULT 1 CHECK (draw_points BETWEEN -100 AND 100),
  loss_points INTEGER NOT NULL DEFAULT 0 CHECK (loss_points BETWEEN -100 AND 100),
  tiebreakers JSONB NOT NULL DEFAULT '["goal_difference","goals_scored","total_wins","head_to_head"]'
    CHECK (jsonb_typeof(tiebreakers) = 'array' AND jsonb_array_length(tiebreakers) = 4 AND tiebreakers @> '["goal_difference","goals_scored","total_wins","head_to_head"]'::jsonb),
  match_duration INTEGER NOT NULL DEFAULT 90 CHECK (match_duration BETWEEN 1 AND 300),
  forfeit_winner_score INTEGER NOT NULL DEFAULT 3 CHECK (forfeit_winner_score BETWEEN 1 AND 99),
  forfeit_loser_score INTEGER NOT NULL DEFAULT 0 CHECK (forfeit_loser_score BETWEEN 0 AND 98),
  forfeit_penalty INTEGER NOT NULL DEFAULT 0 CHECK (forfeit_penalty BETWEEN 0 AND 100),
  CHECK (forfeit_winner_score > forfeit_loser_score)
);
INSERT INTO league_rules (league_id) SELECT id FROM leagues ON CONFLICT (league_id) DO NOTHING;
CREATE OR REPLACE FUNCTION initialize_league_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO league_rules (league_id) VALUES (NEW.id) ON CONFLICT (league_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS initialize_league_rules ON leagues;
CREATE TRIGGER initialize_league_rules AFTER INSERT ON leagues FOR EACH ROW EXECUTE FUNCTION initialize_league_rules();

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_id_league ON teams(id, league_id);
CREATE TABLE IF NOT EXISTS points_adjustments (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL,
  points INTEGER NOT NULL CHECK (points BETWEEN -1000 AND 1000 AND points <> 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 250),
  created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (team_id, league_id) REFERENCES teams(id, league_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_adjustments_league_team ON points_adjustments(league_id, team_id);

ALTER TABLE matches ADD COLUMN IF NOT EXISTS forfeit_team_id INTEGER REFERENCES teams(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS forfeit_home_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS forfeit_away_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS forfeit_penalty INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pre_forfeit_status TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS forfeit_marked_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'matches'::regclass AND conname = 'valid_forfeit') THEN
    ALTER TABLE matches ADD CONSTRAINT valid_forfeit CHECK (
      (forfeit_team_id IS NULL AND forfeit_home_score IS NULL AND forfeit_away_score IS NULL AND forfeit_penalty IS NULL AND pre_forfeit_status IS NULL AND forfeit_marked_at IS NULL)
      OR (forfeit_team_id IS NOT NULL AND forfeit_team_id IN (home_team_id, away_team_id)
        AND status = 'completed' AND pre_forfeit_status IS NOT NULL AND pre_forfeit_status IN ('scheduled', 'completed')
        AND forfeit_home_score IS NOT NULL AND forfeit_away_score IS NOT NULL
        AND forfeit_home_score BETWEEN 0 AND 99 AND forfeit_away_score BETWEEN 0 AND 99
        AND ((forfeit_team_id = home_team_id AND forfeit_home_score < forfeit_away_score) OR (forfeit_team_id = away_team_id AND forfeit_away_score < forfeit_home_score))
        AND forfeit_penalty IS NOT NULL AND forfeit_penalty BETWEEN 0 AND 100 AND forfeit_marked_at IS NOT NULL)
    );
  END IF;
END $$;

-- Phase 3: roster capacity and external image references.
-- Existing rosters and goal attribution are retained. NULL means unlimited.
ALTER TABLE league_rules ADD COLUMN IF NOT EXISTS max_roster_size INTEGER
  CHECK (max_roster_size IS NULL OR max_roster_size BETWEEN 1 AND 1000);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_key TEXT
  CHECK (logo_key IS NULL OR logo_key ~ '^[a-f0-9]{32}\.webp$');
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
