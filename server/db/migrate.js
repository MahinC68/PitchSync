require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { pool } = require('./index')

async function migrate(database = pool) {
  const client = await database.connect()
  let locked = false
  try {
    await client.query('SELECT pg_advisory_lock(728493201)')
    locked = true
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
    for (const name of fs.readdirSync(path.join(__dirname, 'migrations')).filter(name => name.endsWith('.sql')).sort()) {
      const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])
      if (rowCount) continue
      await client.query('BEGIN')
      try {
        await client.query(fs.readFileSync(path.join(__dirname, 'migrations', name), 'utf8'))
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
        await client.query('COMMIT')
        console.log(`Applied ${name}`)
      } catch (error) { await client.query('ROLLBACK'); throw error }
    }
  } finally {
    try { if (locked) await client.query('SELECT pg_advisory_unlock(728493201)') } finally { client.release() }
  }
}

if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => pool.end())
module.exports = migrate
