# Teams and players — Phase 3

Settings → Manage Teams and Manage Players now open the same Teams & Players workspace. Select a team to manage its logo, name and roster. The old `/settings/players` URL redirects to this workspace.

## Migration and existing data

`server/db/migrations/003_team_rosters_logos.sql` adds nullable `league_rules.max_roster_size` and `teams.logo_key`. Existing leagues start with unlimited rosters and existing teams use the initials placeholder. No accounts, players, matches or goals are rewritten or deleted. The normal backend startup migration runner applies this migration transactionally once; `npm --prefix server run migrate` can apply it separately.

The roster setting supports Unlimited, 10, 15, 20, or a custom integer from 1–1000. Lowering it preserves existing players, including rosters already over capacity. Player creation locks the league rules and team rows before checking capacity, preventing simultaneous requests from exceeding the limit. League Rules updates preserve the roster setting.

Player renames update the same player ID. Existing goal IDs and player associations remain intact, and the new name appears throughout the app. Players with recorded goals cannot be deleted; the API returns a useful conflict and the roster explains this restriction. Teams referenced by fixtures cannot be deleted automatically.

Result entry optionally saves scores and scorer entries in one transaction. New scorers use the same roster checks as normal player creation. A capacity or validation failure rolls back the result, goal changes and newly created players together. Existing players can still score when their team is at capacity. The previous score-only API remains supported when `scorers` is omitted. Forfeits retain the existing Phase 2 behavior.

## Logo storage and deployment

The backend requires Node.js **20.9 or newer** for Sharp. Run `npm --prefix server ci` when deploying the dependency changes.

Attach a persistent filesystem volume and set `LOGO_STORAGE_DIR` to its **absolute path**, for example `/data/team-logos`. The API process must be able to write to that directory. Production uploads return a clear 503 when storage is unconfigured or unavailable. Development defaults to the gitignored `server/data/team-logos` directory, which persists across local restarts.

Back up the image directory alongside PostgreSQL. PostgreSQL stores only random image keys, never binary images. Multiple backend replicas must share the same persistent image directory; an ephemeral deploy filesystem is unsuitable.

Uploads accept one PNG, JPEG or WebP file up to 2 MiB and 4096 × 4096 pixels. The server checks the file signature, decoded format, MIME type, dimensions and single-frame requirement, then re-encodes a metadata-free WebP up to 256 × 256 pixels. SVG and animated files are rejected. Original filenames and upload bytes are never served. Immutable public image URLs use random 128-bit keys, with `nosniff` and a restrictive content security policy. Replacements and removals clean up obsolete files after the database commit; failed uploads preserve the previous reference.

Team logos appear in standings, upcoming fixtures, results and team management. Missing or unavailable images fall back to the existing gold initials treatment.

## API changes

All management endpoints require the authenticated administrator and active-league ownership enforced by the existing middleware. Resource IDs are also scoped to that league.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/teams/roster-settings` | Read the league roster limit |
| `PUT /api/teams/roster-settings` | Set `{ "max_roster_size": null }` or an integer from 1–1000 |
| `GET /api/teams` | Includes `logo_key` and `player_count` |
| `PUT /api/teams/:id/logo` | Upload multipart field `logo` |
| `DELETE /api/teams/:id/logo` | Remove the logo reference and file |
| `GET /api/team-logos/:key` | Serve a validated public WebP key |
| `GET /api/players/team/:team_id` | Read an owned team's roster, including `has_goals` |
| `PUT /api/players/:id` | Rename with `{ "name": "New name" }`; other fields are rejected |
| `PUT /api/fixtures/:id/result` | Existing scores plus optional `scorers` array |

A scorer entry is `{ "team_id": 1, "player_id": 2 }` or `{ "team_id": 1, "new_name": "New scorer" }`. New names reuse an existing case-insensitive team-name match. Entries cannot exceed the corresponding team's score. Unknown scorers and own goals may be left unattributed, as before.

## Verification

Use an isolated, migrated PostgreSQL database for backend tests:

```sh
DATABASE_URL=postgresql://USER@localhost:5432/TEST_DATABASE DATABASE_SSL=false npm --prefix server test -- --silent
npm run build
```

`server/tests/rosters.test.js` covers finite/unlimited limits, concurrent additions, lowering limits, renaming without changing goal IDs, deletion constraints, authorization, league isolation, and atomic result entry. `server/tests/logos.test.js` covers upload/replace/remove, image validation, public serving, ownership, storage failures and cleanup.

The new `tests/rosters.spec.js` browser test uses the backend Sharp dependency to generate an upload fixture. Install both frontend and backend dependencies before running it. Point `PITCHSYNC_TEST_BASE_URL` and `PITCHSYNC_TEST_API_URL` at an isolated frontend/API pair, and give that API a temporary `LOGO_STORAGE_DIR`. It verifies the shared roster UI, capacity errors during result entry, logo display, rename attribution, deletion errors and mobile overflow. Existing multi-league, rules and demo portal browser tests remain applicable.

Phase 3 verification: **112 backend tests, 9 browser tests, and the frontend production build passed**. The local migration was also checked against pre-migration fingerprints of accounts, leagues, teams, players, matches, goals, rules and adjustments.

## Changed files

- Database: `server/db/migrations/003_team_rosters_logos.sql`, `server/db/schema.sql`.
- Backend: `server/routes/{teams,players,fixtures,standings,logos}.js`, `server/services/{rosters,results,logos,standings}.js`, `server/index.js`, backend package manifests and `.env.example`.
- Frontend: `src/api.js`, `src/components/{TeamLogo,TeamRoster,AddResultModal,EditResultModal}.jsx`, `TeamLogo.module.css`, and the Schedule, Standings, Settings, SettingsTeams and SettingsPlayers pages and associated changed styles.
- Verification and documentation: `server/tests/{rosters,logos}.test.js`, `tests/rosters.spec.js`, this guide, README and `.gitignore`.
