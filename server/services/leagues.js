const crypto = require('crypto')

function validLeagueName(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100
}

// ON CONFLICT avoids aborting the surrounding transaction if a code collides.
async function createLeague(client, name) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase()
    const { rows: [league] } = await client.query(
      'INSERT INTO leagues (name, access_code) VALUES ($1, $2) ON CONFLICT (access_code) DO NOTHING RETURNING id, name, access_code',
      [name.trim(), code]
    )
    if (league) return league
  }
  throw new Error('Unable to generate a unique league access code')
}

async function ownedLeagues(db, adminId) {
  const { rows } = await db.query(
    `SELECT l.id, l.name, l.access_code FROM leagues l
     JOIN admin_leagues al ON al.league_id = l.id
     WHERE al.admin_id = $1 ORDER BY l.created_at, l.id`, [adminId]
  )
  return rows
}

module.exports = { createLeague, validLeagueName, ownedLeagues }
