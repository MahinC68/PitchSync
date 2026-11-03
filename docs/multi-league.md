# Multi-league admin accounts — Phase 1

## Data model and migration

`admins` represents the account. `admin_leagues(admin_id, league_id)` represents ownership; new leagues are linked only to their creator, preserving the existing single-admin workflow without introducing membership-management features. The composite primary key preserves all legacy account-to-league links, even if an older database already has more than one account referencing a league. No roles, invitations, staff accounts, seasons, or deletion API are introduced.

`server/db/migrations/001_multi_league_accounts.sql` backfills ownership from every existing `admins.league_id`. It retains that legacy column for old seed scripts but makes it nullable and changes its foreign key from `ON DELETE CASCADE` to `ON DELETE SET NULL`, so removing a league through maintenance cannot remove an account owning other leagues. Application authorization never uses the legacy column.

The migration does not change or delete existing account, league, team, player, match, or goal rows. It runs transactionally through `npm run migrate`; the runner serializes migration execution with an advisory lock and records completed files in `schema_migrations`. Repeated runs are safe. Access-code creation uses a unique database constraint and retries collisions without aborting its transaction.

For an **existing database**, deploy the backend and run:

```sh
cd server
npm run migrate
npm start
```

`npm start` and `npm run dev` also run pending migrations before serving requests. Railway's start command is updated to `npm start`. Do not use `schema.sql` to upgrade an existing database. For an empty database, first load `server/db/schema.sql`, then run migrations and start the server. Neither startup nor migration runs any seed script.

Deploy the migrated backend before the new frontend, and stop old backend writers during the rollout. Existing signed JWTs remain accepted until their normal expiry, but their embedded league claim is rechecked against ownership. An old backend build is not multi-league aware; rolling back application code after new accounts/leagues are created requires a separate compatibility plan. Do not drop the ownership table as a rollback.

There is no independent settings table yet. New leagues are initialized with their name and unique code and no teams, players, or fixtures.

## API and authorization

New account endpoints:

- `GET /api/leagues`: list this account's owned leagues.
- `POST /api/leagues { name }`: create a league and its ownership link in one transaction.
- `GET /api/leagues/:id`: verify ownership and return the selected league.
- `PATCH /api/leagues/:id { name }`: rename only an owned league; access code is unchanged.

All require an existing authenticated account. League names are trimmed and must contain 1–100 characters. Login and registration retain `token`, `admin`, and `league` in their responses and also return `leagues`. Registration creates the first league and ownership in the same transaction as the account.

New JWTs identify only the account (`adminId`). Protected league operations use `X-League-Id`, verified against `admin_leagues` on every request. If the header is absent, middleware checks a legacy token's league claim or chooses the account's first owned league. That fallback preserves older clients; no client-provided ID is accepted as authorization.

Existing resource routes remain scoped to the verified league. Fixture creation checks both teams; player creation checks its team; goal creation checks the match, team, and scorer. Fixture deletion relies on the match's cascade only after its league-scoped deletion succeeds, preventing unauthorized goal deletion.

Public standings, fixtures, and scorer reads retain the existing player-portal behavior. Player access-code login and its lack of an account/JWT are unchanged. This phase does not convert those public read endpoints into private endpoints.

## Frontend

The sidebar switcher lists leagues, marks the active one, and offers create/rename dialogs. It remains visible on mobile. General Settings includes name, rename, code/copy, and league-management access. The existing dropdown and button-origin modal animations are reused.

`src/session.js` normalizes old `LeagueId`/`LeagueName` storage and exposes canonical `leagueId`/`leagueName`, preserving aliases for older local clients. A session keeps one account token while changing the active league. Reloads retain that league; a fresh login initially selects the account's first league.

The shared layout subscribes to session/storage updates and keys page content by league. Switching unmounts old dialogs, filters, and loaded lists; cross-tab changes do the same. The API wrapper pins each request to the league active at dispatch and rejects late responses after a session/league change, preventing stale multi-step operations from continuing in a new league.

## Verification

Use a **separate PostgreSQL database** for tests. The backend suite creates its own fixtures and the browser multi-league suite creates disposable accounts/leagues. Do not point the latter at production.

```sh
# From server/, after loading schema.sql into the isolated database:
DATABASE_URL=postgresql://USER@localhost:5432/pitchsync_phase1_test DATABASE_SSL=false npm run migrate
DATABASE_URL=postgresql://USER@localhost:5432/pitchsync_phase1_test DATABASE_SSL=false npm test -- --silent

# Run a separate API on port 3002 from server/:
DATABASE_URL=postgresql://USER@localhost:5432/pitchsync_phase1_test DATABASE_SSL=false PORT=3002 FRONTEND_URL=http://localhost:5175 npm start

# From the repository root, run a frontend against that API:
VITE_API_URL=http://localhost:3002 npm run dev -- --port 5175

# In another terminal at the root:
PITCHSYNC_TEST_BASE_URL=http://localhost:5175 PITCHSYNC_TEST_API_URL=http://localhost:3002 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/multi-league.spec.js --workers=1
npm run build
```

Omit `PLAYWRIGHT_CHANNEL=chrome` to use Playwright's downloaded Chromium. Existing browser regressions can be run against the local demo database with `npx playwright test tests/e2e.spec.js`; override `PITCHSYNC_ADMIN_EMAIL`, `PITCHSYNC_ADMIN_PASSWORD`, and `PITCHSYNC_PLAYER_CODE` for a different seeded account.

Coverage includes registration, two-league ownership, account-only and legacy tokens, switching with the same token, invalid/revoked ownership, cross-league resource injection, unauthorized deletion, independent results/standings/scorers, collision-safe access codes, migration preservation/repeatability, persisted selection, rename, mobile navigation, late responses, cross-tab dialog reset, and player login.

## Changed files

Backend:
- `server/db/migrations/001_multi_league_accounts.sql`, `server/db/migrate.js`, `server/db/schema.sql`, `server/db/seed.sql`: ownership migration, runner, and fresh-install/seed compatibility.
- `server/services/leagues.js`, `server/routes/leagues.js`: validation, unique code creation, ownership listing, create/select/rename APIs.
- `server/middleware/authMiddleware.js`, `server/routes/auth.js`: account identity, per-request ownership verification, compatible login/registration.
- `server/routes/fixtures.js`, `server/routes/players.js`, `server/routes/goals.js`: cross-league reference checks and safe fixture deletion.
- `server/index.js`, `server/package.json`, `server/railway.toml`: JSON error handling, routes, startup migration.

Frontend:
- `src/session.js`, `src/api.js`: normalized/reactive sessions, league headers, late-response guards, management API helpers.
- `src/components/LeagueContext.jsx`, `LeagueSwitcher.jsx`, `LeagueSwitcher.module.css`, `LeagueModal.jsx`: shared account/league controls and accessible create/rename dialogs.
- `src/components/AppLayout.jsx`, `AppLayout.module.css`: desktop/mobile switcher, guarded navigation, league-keyed page reset.
- `src/components/FilterPicker.jsx`, `FilterPicker.module.css`: reuse the themed popup and restrict arrow animation to its arrow.
- `src/pages/Login.jsx`, `Register.jsx`, `Standings.jsx`, `Schedule.jsx`, `Players.jsx`, `SettingsPlayers.jsx`, `src/components/AddResultModal.jsx`: canonical session reads and compatible authentication responses.
- `src/pages/Settings.jsx`, `Settings.module.css`: General Settings and management access.

Tests and documentation:
- `server/tests/multi-league.test.js`, `server/tests/helpers.js`, `server/tests/auth.test.js`.
- `tests/multi-league.spec.js`, `tests/e2e.spec.js`, `playwright.config.js`.
- `README.md`, `docs/multi-league.md`.

Local completion checks: 70 backend tests across five suites; two multi-league browser tests; five existing browser regressions; production frontend build. The existing local demo account still logs in. Before/after row fingerprints confirmed that all original rows in the six existing application tables were unchanged by migration. Test writes used a separate database.

No known Phase 1 blockers remain. Hosting deployment and GitHub publication are separate from local implementation. The existing password-reset email TODO is unchanged.
