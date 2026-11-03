const express        = require('express')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

// ── GET /api/goals/match/:match_id (admin only) ───────────────────────────────
router.get('/match/:match_id', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'SELECT 1 FROM matches WHERE id = $1 AND league_id = $2',
      [req.params.match_id, req.admin.leagueId]
    )
    if (rowCount === 0) return res.status(403).json({ success: false, error: 'Forbidden' })

    const { rows } = await db.query(
      `SELECT g.id, g.player_id, g.team_id, p.name AS player_name
       FROM   goals g
       JOIN   players p ON p.id = g.player_id
       WHERE  g.match_id = $1
       ORDER  BY g.id ASC`,
      [req.params.match_id]
    )
    return res.json({ success: true, data: rows })
  } catch (err) {
    console.error('goals GET match:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── DELETE /api/goals/match/:match_id (admin only) ───────────────────────────
router.delete('/match/:match_id', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'SELECT 1 FROM matches WHERE id = $1 AND league_id = $2',
      [req.params.match_id, req.admin.leagueId]
    )
    if (rowCount === 0) return res.status(403).json({ success: false, error: 'Forbidden' })

    await db.query('DELETE FROM goals WHERE match_id = $1', [req.params.match_id])
    return res.json({ success: true, data: null })
  } catch (err) {
    console.error('goals DELETE match:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── POST /api/goals (admin only) ──────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { match_id, player_id, team_id } = req.body

  if (!match_id || !player_id || !team_id) {
    return res.status(400).json({
      success: false,
      error: 'match_id, player_id, and team_id are required',
    })
  }

  try {
    const { rowCount } = await db.query(
      'SELECT 1 FROM matches WHERE id = $1 AND league_id = $2',
      [match_id, req.admin.leagueId]
    )
    if (rowCount === 0) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const { rows: [goal] } = await db.query(
      `INSERT INTO goals (match_id, player_id, team_id)
       SELECT m.id, p.id, t.id FROM matches m
       JOIN teams t ON t.id = $3 AND t.league_id = m.league_id
       JOIN players p ON p.id = $2 AND p.team_id = t.id AND p.league_id = m.league_id
       WHERE m.id = $1 AND m.league_id = $4 AND t.id IN (m.home_team_id, m.away_team_id)
       RETURNING *`,
      [match_id, player_id, team_id, req.admin.leagueId]
    )

    if (!goal) return res.status(403).json({ success: false, error: 'Scorer and team must belong to this match and league' })
    return res.status(201).json({ success: true, data: goal })
  } catch (err) {
    console.error('goals POST:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
