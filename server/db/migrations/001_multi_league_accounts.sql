-- Additive migration: no accounts, leagues, or league data are deleted.
CREATE TABLE IF NOT EXISTS admin_leagues (
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_id, league_id)
);

-- Preserve every legacy relationship, including any pre-existing shared league.
-- New leagues still get only their creator; no membership-management API is exposed.
ALTER TABLE admin_leagues DROP CONSTRAINT IF EXISTS admin_leagues_league_id_key;
CREATE INDEX IF NOT EXISTS idx_admin_leagues_league_id ON admin_leagues(league_id);

INSERT INTO admin_leagues (admin_id, league_id)
SELECT id, league_id FROM admins WHERE league_id IS NOT NULL
ON CONFLICT (admin_id, league_id) DO NOTHING;

-- Keep the legacy column for old seed scripts; it is no longer authoritative.
-- Removing a league must never cascade-delete an account that owns other leagues.
ALTER TABLE admins ALTER COLUMN league_id DROP NOT NULL;
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_league_id_fkey;
ALTER TABLE admins ADD CONSTRAINT admins_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL;
