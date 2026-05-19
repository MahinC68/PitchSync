const express        = require('express')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

// ── POST /api/teams (admin only) ──────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { name } = req.body

  if (!name) {
    return res.status(400).json({ success: false, error: 'name is required' })
  }

  try {
    const { rows: [team] } = await db.query(
      `INSERT INTO teams (league_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [req.admin.leagueId, name.trim()]
    )

    return res.status(201).json({ success: true, data: team })
  } catch (err) {
    // Unique constraint: team name already exists in this league
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'A team with that name already exists' })
    }
    console.error('teams POST:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── PUT /api/teams/:id (admin only) ──────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  const { name } = req.body

  if (!name) {
    return res.status(400).json({ success: false, error: 'name is required' })
  }

  try {
    const { rows: [team] } = await db.query(
      `UPDATE teams
       SET    name = $1
       WHERE  id = $2 AND league_id = $3
       RETURNING *`,
      [name.trim(), req.params.id, req.admin.leagueId]
    )

    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' })
    }

    return res.json({ success: true, data: team })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'A team with that name already exists' })
    }
    console.error('teams PUT:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── DELETE /api/teams/:id (admin only) ────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM teams WHERE id = $1 AND league_id = $2',
      [req.params.id, req.admin.leagueId]
    )

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Team not found' })
    }

    return res.json({ success: true, data: null })
  } catch (err) {
    console.error('teams DELETE:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
