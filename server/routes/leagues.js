const express = require('express')
const db = require('../db')
const auth = require('../middleware/authMiddleware')
const { createLeague, validLeagueName, ownedLeagues } = require('../services/leagues')
const router = express.Router()
router.use(auth.account)

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await ownedLeagues(db, req.admin.adminId) }) } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  if (!validLeagueName(req.body.name)) return res.status(400).json({ error: 'League name must be between 1 and 100 characters' })
  let client
  try {
    client = await db.pool.connect()
    await client.query('BEGIN')
    const league = await createLeague(client, req.body.name)
    await client.query('INSERT INTO admin_leagues (admin_id, league_id) VALUES ($1, $2)', [req.admin.adminId, league.id])
    await client.query('COMMIT')
    res.status(201).json({ success: true, data: league })
  } catch (error) { if (client) await client.query('ROLLBACK').catch(() => {}); next(error) } finally { client?.release() }
})

router.get('/:id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid league ID' })
  try {
    const { rows: [league] } = await db.query(
      `SELECT l.id, l.name, l.access_code FROM leagues l JOIN admin_leagues al ON al.league_id = l.id
       WHERE l.id = $1 AND al.admin_id = $2`, [req.params.id, req.admin.adminId])
    if (!league) return res.status(403).json({ error: 'You do not own this league' })
    res.json({ success: true, data: league })
  } catch (error) { next(error) }
})

router.patch('/:id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid league ID' })
  if (!validLeagueName(req.body.name)) return res.status(400).json({ error: 'League name must be between 1 and 100 characters' })
  try {
    const { rows: [league] } = await db.query(
      `UPDATE leagues l SET name = $1 FROM admin_leagues al
       WHERE l.id = $2 AND al.league_id = l.id AND al.admin_id = $3
       RETURNING l.id, l.name, l.access_code`, [req.body.name.trim(), req.params.id, req.admin.adminId])
    if (!league) return res.status(403).json({ error: 'You do not own this league' })
    res.json({ success: true, data: league })
  } catch (error) { next(error) }
})
module.exports = router
