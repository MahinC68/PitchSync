# Playoffs and qualification zones — Phase 5

## Use

Open **Settings → Playoffs**. Enable single-elimination playoffs, choose the top 2, 4 or 8 teams, and optionally include a third-place match for four or eight qualifiers. Save settings, preview the seeded matchups, then save the bracket. A preview never creates regular-season fixtures.

The sidebar shows Playoffs for enabled leagues and leagues with a saved bracket. Administrators can record/edit/clear results there; players can view the bracket through their existing access-code session. The bracket shows fixed seeds, participants, scores, penalty winners, pending/completed matches and the champion. Mobile navigation wraps when the extra link is present.

Qualification uses the exact same database snapshot and standings service as the league table: custom win/draw/loss points, configured tiebreakers (including grouped head-to-head), manual adjustments and effective forfeit results/deductions. Every team in the selected league is eligible; no requirement to finish all regular fixtures is imposed. At least the configured number of teams must exist. A preview token binds generation to the standings and saved settings; a changed preview must be regenerated.

Standings highlight the configured number of leading positions only while playoffs are enabled. These are **current qualification positions**, not a changeable version of an already-saved bracket. Seeds and bracket format are fixed when generated. Later standings or settings changes, including disabling playoffs, do not delete or reseed the saved bracket. This phase provides one saved bracket per league, without deletion/replacement or seasons.

## Results and explicit resolution

Scores must be integer values from 0–99. Drawn knockout matches require one of the two participants as the penalty-shootout winner. The winner is stored separately from the drawn score. Non-drawn results cannot include a penalty winner. Both teams must have advanced before a result can be entered.

Winner progression and semifinal-loser progression into the third-place match are transactional. A bracket row lock serializes writes. Every write also requires `expected_revision`, preventing an editor or another browser tab from silently replacing a newer result.

A score edit that keeps the same winner preserves later results. If changing or clearing a result changes participants in a completed dependent match, the API returns `409 DOWNSTREAM_RESULTS` with the exact affected match IDs and labels. The editor names the affected results and offers an explicit **Clear dependent results and save/clear** action. Confirmation resubmits those exact IDs in `reset_match_ids` with the original revision. A changed bracket returns `409 STALE_BRACKET`; close the editor and refresh. Only affected paths are cleared. Unaffected results remain intact, and a cleared final removes the champion until another final result is recorded.

Playoff matches live in separate tables and never enter regular fixtures, standings or dashboard match statistics. This phase intentionally records playoff **team scores only**. There is no playoff player-goal entry; the existing player leaderboard continues to count regular-season goals, excluding forfeited matches as before. Original matches, goals and player associations remain untouched. Teams referenced by a saved bracket cannot be deleted; the team API explains this constraint.

## Migration

`server/db/migrations/004_playoffs.sql` is additive and runs through the normal transactional migration runner:

- Adds `playoffs_enabled` (false), `playoffs_qualifiers` (4) and `playoffs_third_place` (false) to `league_rules`. Existing and newly created leagues remain disabled by default. Existing rule/roster update endpoints preserve these fields.
- Creates `playoff_brackets`, `playoff_entries` and `playoff_matches`.
- Enforces one bracket per league, unique seeds/match slots, league-scoped participant foreign keys, supported formats and valid score/winner combinations.
- Does not change original regular fixtures, scores, goals, teams or players.

Run `npm --prefix server run migrate` before starting the updated API, or use `npm --prefix server start`, which migrates automatically. The local migration was applied successfully and re-running the runner made no further changes. Before/after fingerprints confirmed all original rows in nine tables were preserved: accounts, memberships, leagues, teams, players, matches, goals, rules (excluding the new default fields) and points adjustments.

**Checkout discrepancy:** Phase 4 (venues/rescheduling) is absent from this repository at the start of this work; HEAD was Phase 3 commit `f93871f`. This implementation does not invent or replace Phase 4. Existing fixture and result routes remain separate from playoffs.

## API

All writes use the existing authenticated account and `X-League-Id` ownership middleware. Match IDs must also belong to that league's bracket. Read-only bracket access follows the existing public league standings/fixtures model and contains no admin account data.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/playoffs/league/:id` | Settings plus saved bracket, entries, matches and champion |
| `PUT /api/playoffs/settings` | `{ enabled, qualifiers: 2/4/8, third_place }` |
| `POST /api/playoffs/preview` | Current qualifying seeds, first-round matchups and preview token |
| `POST /api/playoffs/bracket` | `{ token }` saves a reviewed bracket; duplicates return 409 |
| `PUT /api/playoffs/matches/:id/result` | `{ home_score, away_score, penalty_winner_id?, expected_revision, reset_match_ids? }` |
| `DELETE /api/playoffs/matches/:id/result` | `{ expected_revision, reset_match_ids? }` clears a result |

`GET /api/standings/:league_id` also returns each team's `inQualificationZone` and a top-level `qualification` summary. No standings columns were added.

## Verification

All database-writing tests ran against the dedicated **`pitchsync_phase5_test`** PostgreSQL database; no production reset/truncate commands were used. Browser mutation tests used a separate API on port 3003 and frontend on 5176 connected to that database. Existing demo-portal browser tests were read-only.

```sh
DATABASE_URL=postgresql://USER@localhost:5432/TEST_DATABASE DATABASE_SSL=false npm --prefix server test -- --silent
PITCHSYNC_TEST_BASE_URL=http://localhost:5176 PITCHSYNC_TEST_API_URL=http://localhost:3003 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/playoffs.spec.js tests/multi-league.spec.js tests/league-rules.spec.js tests/rosters.spec.js --workers=1
PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e.spec.js --workers=1
npm run build
```

Results: **133 backend tests across 10 suites passed**, including 21 playoff tests; **10 browser tests passed** (5 isolated workflow tests and 5 demo portal regressions); production build passed. The playoff browser workflow covers settings, preview/save, qualification zones, progression, penalties, champion, explicit dependent-result clearing, disabling while preserving the bracket, mobile overflow, and read-only player access. Existing multi-league, roster and custom-rule flows also passed.

## Changed files

- Database: `server/db/migrations/004_playoffs.sql`, `server/db/schema.sql`.
- Backend: `server/services/playoffs.js`, `server/routes/playoffs.js`, `server/index.js`; shared standings read logic in `server/services/standings.js` and `server/routes/standings.js`; constraint messaging in `server/routes/teams.js`.
- Frontend: `src/pages/Playoffs.jsx`, `src/pages/Playoffs.module.css`, `src/pages/PlayoffSettings.jsx`, `src/components/PlayoffResultModal.jsx`; routes in `src/App.jsx`, API functions/error details in `src/api.js`, Settings card, conditional sidebar navigation/mobile wrapping, and configured standings qualification indicators.
- Tests: `server/tests/playoffs.test.js`, bracket cleanup in `server/tests/helpers.js`, `tests/playoffs.spec.js`.
- Documentation: this guide and README.

No new dependencies, unrelated page redesigns, seasons, transfers, extra statistics, staff roles, fixture generation or history features were added. Changes remain local until a push is requested.
