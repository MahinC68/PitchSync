const express        = require('express')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

// ── GET /api/players/:league_id/top-scorers ───────────────────────────────────
router.get('/:league_id/top-scorers', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         p.id,
         p.name  AS player_name,
         t.name  AS team_name,
         COUNT(g.id) AS goals
       FROM   players p
       JOIN   teams   t ON t.id = p.team_id
       LEFT JOIN goals g ON g.player_id = p.id
       WHERE  p.league_id = $1
       GROUP BY p.id, p.name, t.name
       ORDER  BY goals DESC, p.name ASC`,
      [req.params.league_id]
    )

    const data = rows.map((row, i) => ({
      rank:       i + 1,
      playerId:   row.id,
      playerName: row.player_name,
      teamName:   row.team_name,
      goals:      Number(row.goals),
    }))

    return res.json({ success: true, data })
  } catch (err) {
    console.error('top-scorers:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── POST /api/players (admin only) ───────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { name, team_id } = req.body

  if (!name || !team_id) {
    return res.status(400).json({ success: false, error: 'name and team_id are required' })
  }

  try {
    const { rows: [player] } = await db.query(
      `INSERT INTO players (name, team_id, league_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), team_id, req.admin.leagueId]
    )

    return res.status(201).json({ success: true, data: player })
  } catch (err) {
    console.error('players POST:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── DELETE /api/players/:id (admin only) ─────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM players WHERE id = $1 AND league_id = $2',
      [req.params.id, req.admin.leagueId]
    )

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' })
    }

    return res.json({ success: true, data: null })
  } catch (err) {
    console.error('players DELETE:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
