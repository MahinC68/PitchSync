const express = require('express')
const db = require('../db')
const { readStandings } = require('../services/standings')
const router = express.Router()
router.get('/:league_id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.league_id)) return res.status(400).json({ error: 'Invalid league ID' })
  let client
  try {
    // One snapshot keeps settings, results and adjustments mathematically consistent.
    client = await db.pool.connect()
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const { rules, standings } = await readStandings(client, req.params.league_id)
    const qualification = { enabled: rules.playoffs_enabled ?? false, qualifiers: rules.playoffs_qualifiers ?? 4 }
    await client.query('COMMIT')
    res.json({ success: true, data: standings.map(team => ({ ...team, inQualificationZone: qualification.enabled && team.position <= qualification.qualifiers })), rules, qualification })
  } catch (error) { if (client) await client.query('ROLLBACK').catch(() => {}); next(error) } finally { client?.release() }
})
module.exports = router
