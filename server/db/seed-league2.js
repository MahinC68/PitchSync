require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── Teams ────────────────────────────────────────────────────────────────
    const teamNames = ['Red Devils', 'Blue Lions', 'Green Eagles', 'White Wolves']
    const teamIds = []
    for (const name of teamNames) {
      const { rows: [team] } = await client.query(
        'INSERT INTO teams (league_id, name) VALUES ($1, $2) RETURNING id',
        [2, name]
      )
      teamIds.push(team.id)
    }
    const [t1, t2, t3, t4] = teamIds

    // ── Completed Matches ────────────────────────────────────────────────────
    // Red Devils 3-1 Blue Lions
    // Green Eagles 2-2 White Wolves
    // Red Devils 1-0 Green Eagles
    // Blue Lions 2-1 White Wolves
    const matches = [
      [t1, t2, 3, 1, '2025-04-05', '14:00'],
      [t3, t4, 2, 2, '2025-04-05', '16:00'],
      [t1, t3, 1, 0, '2025-04-12', '14:00'],
      [t2, t4, 2, 1, '2025-04-12', '16:00'],
    ]
    for (const [home, away, hs, as_, date, time] of matches) {
      await client.query(
        `INSERT INTO matches
           (league_id, home_team_id, away_team_id, home_score, away_score, date, time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')`,
        [2, home, away, hs, as_, date, time]
      )
    }

    await client.query('COMMIT')
    console.log('Seeding complete')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
