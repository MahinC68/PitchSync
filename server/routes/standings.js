const express = require('express')
const db      = require('../db')

const router = express.Router()

// ── GET /api/standings/:league_id ─────────────────────────────────────────────
router.get('/:league_id', async (req, res) => {
  const { league_id } = req.params

  try {
    // Aggregate home and away stats per team in one pass, then LEFT JOIN to
    // teams so teams with no matches still appear with zeroed stats.
    const { rows: standings } = await db.query(
      `WITH all_results AS (
        SELECT
          home_team_id                                       AS team_id,
          date, id,
          CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS win,
          CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS draw,
          CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS loss,
          home_score AS gf,
          away_score AS ga
        FROM matches
        WHERE league_id = $1 AND status = 'completed'

        UNION ALL

        SELECT
          away_team_id,
          date, id,
          CASE WHEN away_score > home_score THEN 1 ELSE 0 END,
          CASE WHEN away_score = home_score THEN 1 ELSE 0 END,
          CASE WHEN away_score < home_score THEN 1 ELSE 0 END,
          away_score,
          home_score
        FROM matches
        WHERE league_id = $1 AND status = 'completed'
      ),
      team_stats AS (
        SELECT
          team_id,
          COUNT(*)              AS mp,
          SUM(win)              AS w,
          SUM(draw)             AS d,
          SUM(loss)             AS l,
          SUM(gf)               AS gf,
          SUM(ga)               AS ga,
          SUM(gf) - SUM(ga)     AS gd,
          SUM(win * 3 + draw)   AS pts
        FROM all_results
        GROUP BY team_id
      )
      SELECT
        t.id,
        t.name,
        COALESCE(s.mp,  0) AS mp,
        COALESCE(s.w,   0) AS w,
        COALESCE(s.d,   0) AS d,
        COALESCE(s.l,   0) AS l,
        COALESCE(s.gf,  0) AS gf,
        COALESCE(s.ga,  0) AS ga,
        COALESCE(s.gd,  0) AS gd,
        COALESCE(s.pts, 0) AS pts
      FROM   teams t
      LEFT JOIN team_stats s ON s.team_id = t.id
      WHERE  t.league_id = $1
      ORDER BY pts DESC, gd DESC, gf DESC`,
      [league_id]
    )

    // Fetch completed matches ordered chronologically to build form strings
    const { rows: matches } = await db.query(
      `SELECT home_team_id, away_team_id, home_score, away_score
       FROM   matches
       WHERE  league_id = $1 AND status = 'completed'
       ORDER  BY date ASC, id ASC`,
      [league_id]
    )

    // Build per-team result history, then slice the last 5
    const formMap = {}
    for (const m of matches) {
      if (!formMap[m.home_team_id]) formMap[m.home_team_id] = []
      if (!formMap[m.away_team_id]) formMap[m.away_team_id] = []

      if (m.home_score > m.away_score) {
        formMap[m.home_team_id].push('W')
        formMap[m.away_team_id].push('L')
      } else if (m.home_score === m.away_score) {
        formMap[m.home_team_id].push('D')
        formMap[m.away_team_id].push('D')
      } else {
        formMap[m.home_team_id].push('L')
        formMap[m.away_team_id].push('W')
      }
    }

    const data = standings.map((t, i) => ({
      position: i + 1,
      teamId:   t.id,
      teamName: t.name,
      mp:  Number(t.mp),
      w:   Number(t.w),
      d:   Number(t.d),
      l:   Number(t.l),
      gf:  Number(t.gf),
      ga:  Number(t.ga),
      gd:  Number(t.gd),
      pts: Number(t.pts),
      form: (formMap[t.id] || []).slice(-5),
    }))

    return res.json({ success: true, data })
  } catch (err) {
    console.error('standings:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
