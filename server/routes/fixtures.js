const express        = require('express')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

// ── GET /api/fixtures/:league_id ──────────────────────────────────────────────
router.get('/:league_id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         m.id, m.league_id, m.home_team_id, m.away_team_id,
         m.home_score, m.away_score,
         m.date::text, m.time::text, m.status,
         ht.name AS home_team_name,
         at.name AS away_team_name
       FROM   matches m
       JOIN   teams ht ON ht.id = m.home_team_id
       JOIN   teams at ON at.id = m.away_team_id
       WHERE  m.league_id = $1`,
      [req.params.league_id]
    )

    const upcoming = rows
      .filter(r => r.status === 'scheduled')
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    const past = rows
      .filter(r => r.status === 'completed')
      .sort((a, b) => new Date(b.date) - new Date(a.date))

    return res.json({ success: true, data: { upcoming, past } })
  } catch (err) {
    console.error('fixtures GET:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── POST /api/fixtures (admin only) ──────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { home_team_id, away_team_id, date, time } = req.body

  if (!home_team_id || !away_team_id || !date || !time) {
    return res.status(400).json({
      success: false,
      error: 'home_team_id, away_team_id, date and time are required',
    })
  }

  if (home_team_id === away_team_id) {
    return res.status(400).json({ success: false, error: 'A team cannot play itself' })
  }

  try {
    const { rows: [fixture] } = await db.query(
      `INSERT INTO matches (league_id, home_team_id, away_team_id, date, time, status)
       VALUES ($1, $2, $3, $4, $5, 'scheduled')
       RETURNING id, league_id, home_team_id, away_team_id,
                 date::text, time::text, status`,
      [req.admin.leagueId, home_team_id, away_team_id, date, time]
    )

    return res.status(201).json({ success: true, data: fixture })
  } catch (err) {
    console.error('fixtures POST:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── PUT /api/fixtures/:id/result (admin only) ────────────────────────────────
router.put('/:id/result', authMiddleware, async (req, res) => {
  const { home_score, away_score } = req.body

  if (home_score == null || away_score == null) {
    return res.status(400).json({ success: false, error: 'home_score and away_score are required' })
  }

  try {
    const { rows: [match] } = await db.query(
      `UPDATE matches
       SET    home_score = $1, away_score = $2, status = 'completed'
       WHERE  id = $3 AND league_id = $4
       RETURNING id, league_id, home_team_id, away_team_id,
                 home_score, away_score, date::text, time::text, status`,
      [home_score, away_score, req.params.id, req.admin.leagueId]
    )

    if (!match) {
      return res.status(404).json({ success: false, error: 'Fixture not found' })
    }

    return res.json({ success: true, data: match })
  } catch (err) {
    console.error('fixtures PUT result:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
