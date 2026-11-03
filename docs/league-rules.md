# Phase 2 — Custom league rules

## Data and rollout

Migration: `server/db/migrations/002_league_rules.sql`. It is additive, transactional through the existing migration runner, and safe to repeat. Existing leagues receive 3/1/0 points, goal difference → goals scored → total wins → head-to-head tiebreakers, 90-minute duration, a 3–0 forfeit award, and no extra forfeit deduction. A database trigger gives future leagues the same defaults, including leagues created during account registration.

`league_rules` holds one settings row per league. `points_adjustments` holds a team, signed points, reason, and creation/update metadata; its composite team/league foreign key prevents cross-league records. Original scores, scorer records, dates, and team assignments are not rewritten by the migration or by rule changes.

The Phase 1 startup command remains `cd server && npm start`; it runs pending migrations before starting the API. Deploy the migrated backend before the frontend. Fresh installs may initialize `server/db/schema.sql`, which includes the new structures. Do not run seed scripts on existing databases.

## Standings and head-to-head

The API calculates standings on demand from a consistent PostgreSQL snapshot of rules, teams, completed matches, and adjustments. It does not persist a points total that could become stale after settings change.

`points = match points + manual adjustments - recorded forfeit deductions`.

Teams are grouped by that total, then by the configured tiebreakers. Head-to-head builds a mini-table from completed effective results between all teams still tied at that stage, comparing configured match points, mini-table goal difference, then mini-table goals scored. If this splits a group but leaves a smaller tie, head-to-head is reapplied to that smaller group. If it cannot split the group, ranking proceeds to the next configured criterion. Teams still tied after all four criteria use ascending team ID. The algorithm operates on groups rather than a pairwise comparator, avoiding inconsistent sorting in circular multi-team ties.

Manual adjustments and disciplinary forfeit deductions affect the main table total, not mini-table match points. Recent-form stats use the configured W/D/L match points for the last five completed results. Points-per-match and total-table-points dashboard stats use the adjusted table totals. Team goals and goal averages include awarded forfeit scores; player tallies do not. Empty and unplayed results do not manufacture match points.

## Forfeits and history

A forfeit stores separate awarded home/away scores, the forfeiting team, the configured extra deduction, the previous fixture status, and the recording time. It leaves `matches.home_score`, `matches.away_score`, and existing goal rows intact. Public fixture responses expose the effective awarded score alongside `recorded_home_score` and `recorded_away_score`.

Awarded score and extra penalty are **snapshots at recording time**. Changing forfeit defaults affects future recordings, not historical awards. Changing W/D/L points still recalculates all completed outcomes, including recorded forfeits.

A recorded forfeit counts as completed and awards a win/loss from its recorded score. The forfeiting team's snapshot deduction is subtracted once per fixture during calculation; no second automatic manual-adjustment entry is created. Repeating a mark request returns 409, preventing duplicate or accidental changes. Existing player goals are excluded from the leaderboard while the forfeit applies, and scorer writes/deletions and normal result edits are blocked for forfeited matches.

Schedule provides Forfeit actions for scheduled and completed matches. Recorded forfeits have a View forfeit action with an explicit Clear forfeit button. Clearing restores the prior scheduled/completed status and original score/scorer records; it also removes the automatic deduction. Changing a recorded award requires clearing and recording it again. This phase adds no unrelated disciplinary, rules-engine, season, or playoff features.

## API and validation

All settings and adjustment routes require the Phase 1 authenticated ownership check for the active `X-League-Id`:

- `GET /api/rules`
- `PUT /api/rules`: full settings object.
- `GET /api/rules/adjustments`
- `POST /api/rules/adjustments`: `{ team_id, points, reason }`.
- `PUT /api/rules/adjustments/:id`: edit or reassign within the same owned league.
- `DELETE /api/rules/adjustments/:id`.
- `PUT /api/fixtures/:id/forfeit`: `{ forfeiting_team_id }` from the fixture's two teams.
- `DELETE /api/fixtures/:id/forfeit`: explicitly clear the forfeit.

Points settings are integers -100…100. Manual adjustments are non-zero integers -1000…1000 with a trimmed 1–250 character reason. Duration is 1…300 minutes; presets are 30, 45, 60 and 90. All four supported tiebreakers must appear exactly once. The forfeit winning score must exceed the losing score, both within 0…99; its extra deduction is 0…100. Invalid input is rejected server-side. Normal result scores also require integers 0…99.

## UI

Settings → League Rules reuses the dark/gold surfaces, sharp corners, themed pickers, and league-keyed page state. It groups points, tiebreakers with keyboard-accessible up/down controls, duration, forfeit defaults, and manual adjustments. A single Save league rules action saves the points/tiebreakers/duration/forfeit form. Adjustment add/edit/delete actions save independently. Standings display a points-adjustment marker with a hover breakdown; Schedule labels forfeit outcomes and preserves score alignment. The player portal remains read-only.

## Changed files

Backend:
- `server/db/migrations/002_league_rules.sql`, `server/db/schema.sql` — new rules, adjustment, and forfeit structures.
- `server/services/rules.js`, `server/services/standings.js` — shared validation and deterministic calculation.
- `server/routes/rules.js`, `server/routes/standings.js`, `server/routes/fixtures.js`, `server/routes/goals.js`, `server/routes/players.js`, `server/index.js` — settings/adjustment APIs, effective results, guarded forfeits, and scorer isolation.

Frontend:
- `src/pages/LeagueRules.jsx`, `LeagueRules.module.css`, `src/App.jsx`, `src/pages/Settings.jsx` — the rules page and existing settings navigation.
- `src/components/ForfeitModal.jsx`, `Modal.module.css`, `src/pages/Schedule.jsx`, `Schedule.module.css` — forfeit record/clear flow with the existing button-origin animation.
- `src/pages/Standings.jsx`, `Standings.module.css`, `standingsStats.js`, `src/api.js` — adjusted totals, rule-aware dashboard math, and API helpers.

Tests:
- `server/tests/rules-calculation.test.js` — default/alternative points, reordered criteria, two/multi-team H2H, stable circular ties, forfeit and manual adjustment arithmetic.
- `server/tests/rules.test.js` — persistence, validation, automatic defaults, ownership/isolation, adjustment CRUD, historical preservation, forfeit idempotency/restoration, and repeat migration safety.
- `tests/league-rules.spec.js` — the full settings, adjustment, scoreboard/dashboard, record/clear forfeit, mobile and league-switching browser flow.

Run backend tests with the isolated database instructions in `docs/multi-league.md`. With the separate test API/frontend running:

```sh
PITCHSYNC_TEST_BASE_URL=http://localhost:5175 PITCHSYNC_TEST_API_URL=http://localhost:3002 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/league-rules.spec.js tests/multi-league.spec.js --workers=1
npm run build
```

The browser suites create disposable test accounts; point them at an isolated database, not production. Existing browser regressions are in `tests/e2e.spec.js`.
