const express        = require('express')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

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
    // Scope check: ensure match belongs to the admin's league
    const { rowCount } = await db.query(
      'SELECT 1 FROM matches WHERE id = $1 AND league_id = $2',
      [match_id, req.admin.leagueId]
    )
    if (rowCount === 0) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const { rows: [goal] } = await db.query(
      'INSERT INTO goals (match_id, player_id, team_id) VALUES ($1, $2, $3) RETURNING *',
      [match_id, player_id, team_id]
    )

    return res.status(201).json({ success: true, data: goal })
  } catch (err) {
    console.error('goals POST:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
