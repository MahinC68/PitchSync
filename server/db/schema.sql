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
-- One admin per league. reset_token is null unless a password reset is pending.
CREATE TABLE IF NOT EXISTS admins (
  id                 SERIAL      PRIMARY KEY,
  email              TEXT        NOT NULL UNIQUE,
  password_hash      TEXT        NOT NULL,
  league_id          INTEGER     NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  reset_token        TEXT,
  reset_token_expiry TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
