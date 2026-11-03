# League branding, announcements and integrated settings — Phase 6

## Delivered functionality

Settings is organized into **General**, **League Rules**, **Competition**, **Teams & Players**, and **Announcements**. General stays inline; the other sections reuse the existing rules, playoff and shared roster pages. The old `/settings/players` bookmark still redirects to the roster workspace. No new sidebar links were added.

General reuses account-level league renaming and switching. Administrators can upload, replace and remove the active league's logo. Logos appear in the sidebar switcher (including its league list), the player's sidebar identity, the standings league header, announcement headers and General settings. Missing or failed images use the same gold initials placeholder as team logos. Team and league image references are independent.

Announcements have a title (1–120 characters), a message (1–5000 characters) and a server-assigned publication timestamp. They publish immediately. Editing preserves the announcement ID and original publication date. Administrators can create, edit, delete and browse announcements under Settings; administrators and players can read them at `/announcements`. The standings dashboard shows only the three latest updates with expandable messages and a View all link. The full list paginates 20 announcements at a time, newest publication first, with ID as a stable secondary order. Plain text is rendered through React, including line breaks; uploaded HTML/scripts are not interpreted.

All management writes require authenticated league ownership, and resource updates/deletes also scope IDs to the active league. Body-supplied league IDs, publication dates and extra announcement fields are rejected. Public identity contains only league ID, name and logo reference; public announcement reading follows the existing read-only league standings model and exposes no account/access-code details.

## Reused infrastructure and isolation

- Existing `renameLeague`, league switcher, ownership middleware, session store and active-league route reset.
- Existing Sharp normalization, random WebP storage keys, persistent filesystem storage, image serving headers and initials fallback. Multipart validation is now shared by team and league uploads.
- Existing themed modal, button-origin animation, focus handling and reduced-motion behavior for announcement editing.
- Existing standings, custom league rules, rosters, result recording and playoff implementations remain in place.

Branding updates refresh the league list, sidebar, current identity and session metadata together. Delayed identity reads cannot replace a locally saved branding update. League switching discards old editors and page state; old-league responses are ignored by both the API session check and component cleanup. Existing cross-tab switching is preserved. Player identity refreshes from the server when navigating, so a stored session name is not authoritative.

## Migration and storage

`server/db/migrations/005_branding_announcements.sql` adds nullable `leagues.logo_key`, creates `announcements`, and adds the league/publication index. It is additive and uses the existing transactional migration runner. Existing leagues keep their names, access codes and data, start with no league logo, and have no announcements seeded automatically.

The migration was applied locally. Before/after fingerprints confirmed original rows were unchanged in **12 tables**: admins, memberships, leagues (excluding the newly added null logo field), teams, players, regular matches, goals, league rules, points adjustments, playoff brackets, playoff entries and playoff matches. Restarting the backend ran the migration runner again without applying further changes.

Production uses the existing **absolute `LOGO_STORAGE_DIR` on a persistent mounted volume** for both league and team logos. Keep the same directory as existing team assets; back it up alongside PostgreSQL and share it between API replicas. Development retains the gitignored `server/data/team-logos` default. PostgreSQL stores only the file reference, never binary image data. No new dependency or environment variable is required; the existing Sharp dependency requires Node.js 20.9+.

The shared validation accepts one non-animated PNG, JPEG or WebP up to 2 MiB and 4096 × 4096 pixels, verifies signature/decoded format/MIME type, strips metadata and re-encodes a WebP up to 256 × 256. Production rejects unconfigured/relative storage. Failed uploads preserve the previous reference; replacement/removal cleans obsolete files after commit. Original filenames are not used as storage paths.

## API additions

| Endpoint | Purpose |
| --- | --- |
| `GET /api/branding/league/:id` | Public current identity: ID, name, logo key |
| `PUT /api/branding/logo` | Upload multipart field `logo` for the owned active league |
| `DELETE /api/branding/logo` | Remove the owned active league's logo |
| `GET /api/league-logos/:key` | Shared safe WebP serving infrastructure |
| `GET /api/announcements/league/:id?limit=20&offset=0` | Read `{ items, total, limit, offset }`; limit 1–50 |
| `POST /api/announcements` | Publish `{ title, message }` in the active league |
| `PUT /api/announcements/:id` | Edit title/message in place within the active league |
| `DELETE /api/announcements/:id` | Delete only within the owned active league |

Existing owned-league and General settings responses now include `logo_key`. Existing rename, rule, roster, fixture and playoff API contracts remain supported.

## Verification

All database-writing tests used the dedicated PostgreSQL database **`pitchsync_phase6_test`**. Browser mutation tests used frontend 5177/API 3004 and a temporary upload directory, connected exclusively to that database. No production resets or truncations were run. Demo browser regressions against the normal local app were read-only.

| Area | Result |
| --- | --- |
| Full backend suite | **147 passed**, 12 suites; no final failures |
| New branding/announcement browser workflows | **2 passed**, including player access and delayed-response isolation |
| Existing multi-league, rules, roster and playoff browser workflows | **5 passed** |
| Existing demo login/player/standings/schedule/leaderboard browser checks | **5 passed** |
| Frontend production build | Passed |
| Database preservation and migration repeat | Passed |
| Phase 4 venues, fixture rescheduling and scheduling-conflict detection | **Unavailable in this checkout; cannot verify** |

The backend suite covers account registration/login and league switching/ownership; points and tiebreakers including head-to-head; adjustments and forfeits; team/player CRUD and rename attribution; finite/unlimited roster capacity; regular result/goal workflows; playoff generation, qualification and progression; image validation/storage errors; announcement CRUD, publication dates, pagination and league isolation. Browser checks exercise the reorganized settings and preserve the legacy roster URL.

```sh
DATABASE_URL=postgresql://USER@localhost:5432/TEST_DATABASE DATABASE_SSL=false npm --prefix server test -- --silent
PITCHSYNC_TEST_BASE_URL=http://localhost:5177 PITCHSYNC_TEST_API_URL=http://localhost:3004 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/branding-announcements.spec.js tests/multi-league.spec.js tests/league-rules.spec.js tests/rosters.spec.js tests/playoffs.spec.js --workers=1
PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e.spec.js --workers=1
npm run build
```

## Limitations and remaining integration gap

**Phase 4 is absent from the starting repository (HEAD `c0a4269`).** There is no venue/rescheduling schema, fixture-edit endpoint or scheduling-conflict detection to reuse or test. This upgrade preserves the existing fixture/result workflows and does not invent a separate Phase 4 implementation. Integrating and verifying that phase remains outstanding.

Announcement publication dates are assigned automatically, not scheduled or manually edited. Readers load announcements on dashboard navigation/refresh; there are no external or live notification services. Production uploads still require the persistent storage configuration established in Phase 3.

No seasons, divisions, promotion/relegation, automatic fixtures, transfers, additional admins, additional player statistics, activity history, custom colours/descriptions/columns, or visibility controls were introduced. No changes were pushed to GitHub.

## Files changed

- Database: `server/db/migrations/005_branding_announcements.sql`, `server/db/schema.sql`.
- Backend: `server/routes/branding.js`, `server/routes/announcements.js`, `server/middleware/logoUpload.js`; integration in `server/index.js`, `server/middleware/authMiddleware.js`, `server/routes/leagues.js`, `server/routes/teams.js`, `server/services/leagues.js`, `server/services/logos.js`, `.env.example`.
- Frontend additions: `GeneralSettings`, `LeagueLogo`, `LeagueHeader`, `AnnouncementPanel`, `AnnouncementModal`, and the `Announcements` page with associated CSS modules.
- Frontend integration: `src/App.jsx`, `src/api.js`, `src/session.js`, `AppLayout`, `LeagueSwitcher`, `TeamLogo`, `Settings`, `Standings`, and affected styles.
- Tests: new `server/tests/branding.test.js`, `server/tests/announcements.test.js`, `tests/branding-announcements.spec.js`; existing multi-league, roster and playoff browser selectors updated for grouped Settings.
- Documentation: this guide, README and the persistent-upload comment in the backend environment example.
