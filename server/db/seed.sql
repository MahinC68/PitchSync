-- ─── PitchSync Seed Data ─────────────────────────────────────────────────────
-- Run AFTER schema.sql:  psql $DATABASE_URL -f server/db/seed.sql
--
-- Admin credentials: admin@demo.com / demo1234
-- The hash below was generated with bcryptjs (10 rounds).
-- Regenerate for real deployments:
--   node -e "require('bcryptjs').hash('demo1234', 10).then(console.log)"

BEGIN;

TRUNCATE TABLE goals, matches, players, teams, admins, leagues
  RESTART IDENTITY CASCADE;

-- ── League ────────────────────────────────────────────────────────────────────
INSERT INTO leagues (id, name, access_code) VALUES
  (1, 'Metro Sunday League', 'METRO2025');

-- ── Admin ─────────────────────────────────────────────────────────────────────
INSERT INTO admins (id, email, password_hash, league_id) VALUES
  (1, 'admin@demo.com',
   '$2b$10$KIX.PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.HERE.xxxxx',
   1);

-- ── Teams ─────────────────────────────────────────────────────────────────────
INSERT INTO teams (id, league_id, name) VALUES
  (1, 1, 'Falcons FC'),
  (2, 1, 'City Rovers'),
  (3, 1, 'Kings FC'),
  (4, 1, 'United SC');

-- ── Players (2 per team) ──────────────────────────────────────────────────────
INSERT INTO players (id, team_id, league_id, name) VALUES
  (1,  1, 1, 'Marcus Webb'),
  (2,  1, 1, 'Sam Okafor'),
  (3,  2, 1, 'Jordan Cole'),
  (4,  2, 1, 'Dylan Marsh'),
  (5,  3, 1, 'Theo Nkosi'),
  (6,  3, 1, 'Aiden Torres'),
  (7,  4, 1, 'Liam Brennan'),
  (8,  4, 1, 'Callum Reid');

-- ── Matches (6 completed) ─────────────────────────────────────────────────────
-- Standings after these results:
--   1. Falcons FC   7 pts  (2W 1D 0L  GF 4  GA 1  GD +3)
--   2. Kings FC     5 pts  (1W 2D 0L  GF 3  GA 1  GD +2)
--   3. City Rovers  3 pts  (1W 0D 2L  GF 2  GA 4  GD -2)
--   4. United SC    1 pt   (0W 1D 2L  GF 1  GA 4  GD -3)
INSERT INTO matches
  (id, league_id, home_team_id, away_team_id, home_score, away_score, date, time, status)
VALUES
  (1, 1, 1, 2, 2, 1, '2025-04-05', '15:00', 'completed'),  -- Falcons 2-1 City Rovers
  (2, 1, 3, 4, 1, 1, '2025-04-05', '17:30', 'completed'),  -- Kings 1-1 United
  (3, 1, 2, 3, 0, 2, '2025-04-12', '15:00', 'completed'),  -- City Rovers 0-2 Kings
  (4, 1, 4, 1, 0, 2, '2025-04-12', '17:30', 'completed'),  -- United 0-2 Falcons
  (5, 1, 1, 3, 0, 0, '2025-04-19', '15:00', 'completed'),  -- Falcons 0-0 Kings
  (6, 1, 2, 4, 1, 0, '2025-04-19', '17:30', 'completed');  -- City Rovers 1-0 United

-- ── Goals (10 total) ──────────────────────────────────────────────────────────
INSERT INTO goals (id, match_id, player_id, team_id) VALUES
  -- Match 1: Falcons 2-1 City Rovers
  (1,  1, 1, 1),   -- Marcus Webb   (Falcons)
  (2,  1, 1, 1),   -- Marcus Webb   (Falcons)
  (3,  1, 3, 2),   -- Jordan Cole   (City Rovers)
  -- Match 2: Kings 1-1 United
  (4,  2, 5, 3),   -- Theo Nkosi    (Kings)
  (5,  2, 7, 4),   -- Liam Brennan  (United)
  -- Match 3: City Rovers 0-2 Kings
  (6,  3, 6, 3),   -- Aiden Torres  (Kings)
  (7,  3, 5, 3),   -- Theo Nkosi    (Kings)
  -- Match 4: United 0-2 Falcons
  (8,  4, 2, 1),   -- Sam Okafor    (Falcons)
  (9,  4, 1, 1),   -- Marcus Webb   (Falcons)
  -- Match 5: Falcons 0-0 Kings — no goals
  -- Match 6: City Rovers 1-0 United
  (10, 6, 4, 2);   -- Dylan Marsh   (City Rovers)

-- Reset sequences so the next INSERT without an explicit id works correctly
SELECT setval('leagues_id_seq', (SELECT MAX(id) FROM leagues));
SELECT setval('admins_id_seq',  (SELECT MAX(id) FROM admins));
SELECT setval('teams_id_seq',   (SELECT MAX(id) FROM teams));
SELECT setval('players_id_seq', (SELECT MAX(id) FROM players));
SELECT setval('matches_id_seq', (SELECT MAX(id) FROM matches));
SELECT setval('goals_id_seq',   (SELECT MAX(id) FROM goals));

COMMIT;
