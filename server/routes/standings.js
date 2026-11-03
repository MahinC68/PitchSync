const express = require('express')
const db = require('../db')
const { getRules } = require('../services/rules')
const { calculateStandings } = require('../services/standings')
const router = express.Router()
router.get('/:league_id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.league_id)) return res.status(400).json({ error: 'Invalid league ID' })
  let client
  try {
    // One snapshot keeps settings, results and adjustments mathematically consistent.
    client = await db.pool.connect()
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const rules = await getRules(client, req.params.league_id)
    const { rows: teams } = await client.query('SELECT id, name FROM teams WHERE league_id = $1 ORDER BY id', [req.params.league_id])
    const { rows: matches } = await client.query("SELECT *, date::text FROM matches WHERE league_id = $1 AND status = 'completed'", [req.params.league_id])
    const { rows: adjustments } = await client.query('SELECT team_id, points FROM points_adjustments WHERE league_id = $1', [req.params.league_id])
    await client.query('COMMIT')
    res.json({ success: true, data: calculateStandings(teams, matches, adjustments, rules), rules })
  } catch (error) { if (client) await client.query('ROLLBACK').catch(() => {}); next(error) } finally { client?.release() }
})
module.exports = router
