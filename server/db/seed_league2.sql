-- ─── PitchSync – League 2 Test Data ─────────────────────────────────────────
-- Run this ONCE to populate league 2 ("Sunday League") with teams, players,
-- completed matches, goals, and two upcoming fixtures.
--
--   psql $DATABASE_URL -f server/db/seed_league2.sql
--
-- Expected standings after this seed:
--   1. Rangers FC    9 pts  (3W 0D 0L  GF 4  GA 0  GD +4)
--   2. Rovers United 4 pts  (1W 1D 1L  GF 3  GA 3  GD  0)
--   3. Athletic CF   3 pts  (1W 0D 2L  GF 2  GA 4  GD -2)
--   4. Dynamo SC     1 pt   (0W 1D 2L  GF 3  GA 5  GD -2)
--
-- Top scorers: James Hart 3, Finn O'Brien 2, Zach Perry 2, others 1

BEGIN;

DO $$
DECLARE
  t1 INT; t2 INT; t3 INT; t4 INT;
  p1 INT; p2 INT; p3 INT; p4 INT;
  p5 INT; p6 INT; p7 INT; p8 INT;
  m1 INT; m2 INT; m3 INT; m4 INT; m5 INT; m6 INT;
BEGIN

  -- ── Teams ────────────────────────────────────────────────────────────────────
  INSERT INTO teams (league_id, name) VALUES (2, 'Rangers FC')    RETURNING id INTO t1;
  INSERT INTO teams (league_id, name) VALUES (2, 'Athletic CF')   RETURNING id INTO t2;
  INSERT INTO teams (league_id, name) VALUES (2, 'Rovers United') RETURNING id INTO t3;
  INSERT INTO teams (league_id, name) VALUES (2, 'Dynamo SC')     RETURNING id INTO t4;

  -- ── Players (2 per team) ─────────────────────────────────────────────────────
  INSERT INTO players (team_id, league_id, name) VALUES (t1, 2, 'James Hart')    RETURNING id INTO p1;
  INSERT INTO players (team_id, league_id, name) VALUES (t1, 2, 'Owen Blake')    RETURNING id INTO p2;
  INSERT INTO players (team_id, league_id, name) VALUES (t2, 2, 'Noel Cruz')     RETURNING id INTO p3;
  INSERT INTO players (team_id, league_id, name) VALUES (t2, 2, 'Ben Sharp')     RETURNING id INTO p4;
  INSERT INTO players (team_id, league_id, name) VALUES (t3, 2, 'Finn O''Brien') RETURNING id INTO p5;
  INSERT INTO players (team_id, league_id, name) VALUES (t3, 2, 'Kyle Mann')     RETURNING id INTO p6;
  INSERT INTO players (team_id, league_id, name) VALUES (t4, 2, 'Zach Perry')    RETURNING id INTO p7;
  INSERT INTO players (team_id, league_id, name) VALUES (t4, 2, 'Ethan Cole')    RETURNING id INTO p8;

  -- ── Completed Matches ────────────────────────────────────────────────────────
  INSERT INTO matches (league_id, home_team_id, away_team_id, home_score, away_score, date, time, status)
    VALUES (2, t1, t2, 2, 0, '2025-04-06', '14:00', 'completed') RETURNING id INTO m1; -- Rangers 2-0 Athletic
  INSERT INTO matches (league_id, home_team_id, away_team_id, home_score, away_score, date, time, status)
    VALUES (2, t3, t4, 1, 1, '2025-04-06', '16:00', 'completed') RETURNING id INTO m2; -- Rovers 1-1 Dynamo
  INSERT INTO matches (league_id, home_team_id, away_team_id, home_score, away_score, date, time, status)
    VALUES (2, t2, t1, 0, 1, '2025-04-13', '14:00', 'completed') RETURNING id INTO m3; -- Athletic 0-1 Rangers
  INSERT INTO matches (league_id, home_team_id, away_team_id, home_score, away_score, date, time, status)
    VALUES (2, t4, t3, 1, 2, '2025-04-13', '16:00', 'completed') RETURNING id INTO m4; -- Dynamo 1-2 Rovers
  INSERT INTO matches (league_id, home_team_id, away_team_id, home_score, away_score, date, time, status)
    VALUES (2, t1, t3, 1, 0, '2025-04-20', '14:00', 'completed') RETURNING id INTO m5; -- Rangers 1-0 Rovers
  INSERT INTO matches (league_id, home_team_id, away_team_id, home_score, away_score, date, time, status)
    VALUES (2, t2, t4, 2, 1, '2025-04-20', '16:00', 'completed') RETURNING id INTO m6; -- Athletic 2-1 Dynamo

  -- ── Upcoming Fixtures ────────────────────────────────────────────────────────
  INSERT INTO matches (league_id, home_team_id, away_team_id, date, time, status)
    VALUES (2, t3, t1, '2025-05-25', '14:00', 'scheduled');                            -- Rovers vs Rangers
  INSERT INTO matches (league_id, home_team_id, away_team_id, date, time, status)
    VALUES (2, t4, t2, '2025-05-25', '16:00', 'scheduled');                            -- Dynamo vs Athletic

  -- ── Goals ────────────────────────────────────────────────────────────────────
  -- Match 1: Rangers 2-0 Athletic
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m1, p1, t1); -- James Hart
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m1, p1, t1); -- James Hart
  -- Match 2: Rovers 1-1 Dynamo
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m2, p5, t3); -- Finn O'Brien
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m2, p7, t4); -- Zach Perry
  -- Match 3: Athletic 0-1 Rangers
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m3, p2, t1); -- Owen Blake
  -- Match 4: Dynamo 1-2 Rovers
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m4, p8, t4); -- Ethan Cole
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m4, p5, t3); -- Finn O'Brien
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m4, p6, t3); -- Kyle Mann
  -- Match 5: Rangers 1-0 Rovers
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m5, p1, t1); -- James Hart
  -- Match 6: Athletic 2-1 Dynamo
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m6, p3, t2); -- Noel Cruz
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m6, p4, t2); -- Ben Sharp
  INSERT INTO goals (match_id, player_id, team_id) VALUES (m6, p7, t4); -- Zach Perry

END;
$$;

COMMIT;
