const express        = require('express')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const { getRules, integer } = require('../services/rules')
const { effectiveScore } = require('../services/standings')
const router = express.Router()

// ── GET /api/fixtures/:league_id ──────────────────────────────────────────────
router.get('/:league_id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         m.id, m.league_id, m.home_team_id, m.away_team_id,
         m.home_score AS recorded_home_score, m.away_score AS recorded_away_score,
         CASE WHEN m.forfeit_team_id IS NULL THEN m.home_score ELSE m.forfeit_home_score END AS home_score,
         CASE WHEN m.forfeit_team_id IS NULL THEN m.away_score ELSE m.forfeit_away_score END AS away_score,
         m.forfeit_team_id, m.forfeit_penalty, m.pre_forfeit_status,
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

  if (String(home_team_id) === String(away_team_id)) {
    return res.status(400).json({ success: false, error: 'A team cannot play itself' })
  }

  try {
    const { rows: [fixture] } = await db.query(
      `INSERT INTO matches (league_id, home_team_id, away_team_id, date, time, status)
       SELECT $1, home.id, away.id, $4, $5, 'scheduled'
       FROM teams home, teams away
       WHERE home.id = $2 AND away.id = $3 AND home.league_id = $1 AND away.league_id = $1
       RETURNING id, league_id, home_team_id, away_team_id,
                 date::text, time::text, status`,
      [req.admin.leagueId, home_team_id, away_team_id, date, time]
    )

    if (!fixture) return res.status(403).json({ success: false, error: 'Both teams must belong to the active league' })
    return res.status(201).json({ success: true, data: fixture })
  } catch (err) {
    console.error('fixtures POST:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── PUT /api/fixtures/:id/result (admin only) ────────────────────────────────
router.put('/:id/result', authMiddleware, async (req, res) => {
  const { home_score, away_score } = req.body

  if (!integer(home_score, 0, 99) || !integer(away_score, 0, 99)) {
    return res.status(400).json({ success: false, error: 'Scores must be integers between 0 and 99' })
  }

  try {
    const { rows: [match] } = await db.query(
      `UPDATE matches
       SET    home_score = $1, away_score = $2, status = 'completed'
       WHERE  id = $3 AND league_id = $4 AND forfeit_team_id IS NULL
       RETURNING id, league_id, home_team_id, away_team_id,
                 home_score, away_score, date::text, time::text, status`,
      [home_score, away_score, req.params.id, req.admin.leagueId]
    )

    if (!match) {
      const forfeited = await db.query('SELECT 1 FROM matches WHERE id=$1 AND league_id=$2 AND forfeit_team_id IS NOT NULL', [req.params.id, req.admin.leagueId])
      if (forfeited.rowCount) return res.status(409).json({ error: 'Clear the forfeit before editing the original result' })
      return res.status(404).json({ success: false, error: 'Fixture not found' })
    }

    return res.json({ success: true, data: match })
  } catch (err) {
    console.error('fixtures PUT result:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// Record a separate awarded outcome. Original scores and scorers remain intact.
router.put('/:id/forfeit', authMiddleware, async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id) || !integer(req.body.forfeiting_team_id, 1, 2147483647)) return res.status(400).json({ error: 'Choose the forfeiting team' })
  let client
  try {
    client = await db.pool.connect()
    await client.query('BEGIN')
    const { rows: [match] } = await client.query('SELECT * FROM matches WHERE id=$1 AND league_id=$2 FOR UPDATE', [req.params.id, req.admin.leagueId])
    if (!match) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Fixture not found' }) }
    if (match.forfeit_team_id != null) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This fixture is already forfeited. Clear it before recording a different forfeit.' }) }
    const team = req.body.forfeiting_team_id
    if (![match.home_team_id, match.away_team_id].includes(team)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Forfeiting team must be playing in this fixture' }) }
    const rules = await getRules(client, req.admin.leagueId, true)
    const home = team === match.home_team_id ? rules.forfeit_loser_score : rules.forfeit_winner_score
    const away = team === match.away_team_id ? rules.forfeit_loser_score : rules.forfeit_winner_score
    const { rows: [saved] } = await client.query(`UPDATE matches SET pre_forfeit_status=status, status='completed', forfeit_team_id=$3,
      forfeit_home_score=$4, forfeit_away_score=$5, forfeit_penalty=$6, forfeit_marked_at=NOW() WHERE id=$1 AND league_id=$2 RETURNING *`,
      [match.id, req.admin.leagueId, team, home, away, rules.forfeit_penalty])
    await client.query('COMMIT')
    const [home_score, away_score] = effectiveScore(saved)
    res.json({ success: true, data: { ...saved, recorded_home_score: saved.home_score, recorded_away_score: saved.away_score, home_score, away_score } })
  } catch (error) { if (client) await client.query('ROLLBACK').catch(() => {}); next(error) } finally { client?.release() }
})

router.delete('/:id/forfeit', authMiddleware, async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid fixture ID' })
  try {
    const { rows: [match] } = await db.query(`UPDATE matches SET status=pre_forfeit_status, forfeit_team_id=NULL, forfeit_home_score=NULL,
      forfeit_away_score=NULL, forfeit_penalty=NULL, pre_forfeit_status=NULL, forfeit_marked_at=NULL
      WHERE id=$1 AND league_id=$2 AND forfeit_team_id IS NOT NULL RETURNING *`, [req.params.id, req.admin.leagueId])
    if (!match) return res.status(404).json({ error: 'Forfeited fixture not found' })
    res.json({ success: true, data: match })
  } catch (error) { next(error) }
})

// ── DELETE /api/fixtures/:id (admin only) ─────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Goals cascade only after the league-scoped match deletion succeeds.
    const { rowCount } = await db.query(
      'DELETE FROM matches WHERE id = $1 AND league_id = $2',
      [req.params.id, req.admin.leagueId]
    )
    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Fixture not found' })
    }
    return res.json({ success: true, data: null })
  } catch (err) {
    console.error('fixtures DELETE:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
