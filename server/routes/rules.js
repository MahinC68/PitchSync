const express = require('express')
const db = require('../db')
const auth = require('../middleware/authMiddleware')
const { getRules, validateRules, integer } = require('../services/rules')
const router = express.Router()
router.use(auth)
router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await getRules(db, req.admin.leagueId) }) } catch (error) { next(error) }
})
router.put('/', async (req, res, next) => {
  const rules = req.body
  if (!validateRules(rules)) return res.status(400).json({ error: 'Invalid league rules. Use integer points (-100 to 100), all four unique tiebreakers, duration 1–300, a winning forfeit score up to 99, and penalty 0–100.' })
  try {
    const { rows: [saved] } = await db.query(
      `UPDATE league_rules SET win_points=$2, draw_points=$3, loss_points=$4, tiebreakers=$5::jsonb,
       match_duration=$6, forfeit_winner_score=$7, forfeit_loser_score=$8, forfeit_penalty=$9 WHERE league_id=$1 RETURNING *`,
      [req.admin.leagueId, rules.win_points, rules.draw_points, rules.loss_points, JSON.stringify(rules.tiebreakers), rules.match_duration, rules.forfeit_winner_score, rules.forfeit_loser_score, rules.forfeit_penalty])
    res.json({ success: true, data: saved })
  } catch (error) { next(error) }
})
router.get('/adjustments', async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT a.*, t.name AS team_name FROM points_adjustments a JOIN teams t ON t.id=a.team_id AND t.league_id=a.league_id WHERE a.league_id=$1 ORDER BY a.created_at DESC, a.id DESC`, [req.admin.leagueId])
    res.json({ success: true, data: rows })
  } catch (error) { next(error) }
})
function validAdjustment(body) {
  return integer(body.team_id, 1, 2147483647) && integer(body.points, -1000, 1000) && body.points !== 0 && typeof body.reason === 'string' && body.reason.trim().length > 0 && body.reason.trim().length <= 250
}
router.post('/adjustments', async (req, res, next) => {
  if (!validAdjustment(req.body)) return res.status(400).json({ error: 'Choose a team, non-zero integer points (-1000 to 1000), and a reason (1–250 characters).' })
  try {
    const { rows: [adjustment] } = await db.query(`INSERT INTO points_adjustments (league_id, team_id, points, reason, created_by)
      SELECT $1, id, $3, $4, $5 FROM teams WHERE id=$2 AND league_id=$1 RETURNING *`, [req.admin.leagueId, req.body.team_id, req.body.points, req.body.reason.trim(), req.admin.adminId])
    if (!adjustment) return res.status(403).json({ error: 'Team must belong to the active league' })
    res.status(201).json({ success: true, data: adjustment })
  } catch (error) { next(error) }
})
router.put('/adjustments/:id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id) || !validAdjustment(req.body)) return res.status(400).json({ error: 'Invalid adjustment. Choose a team, non-zero integer points and a reason (1–250 characters).' })
  try {
    const { rows: [adjustment] } = await db.query(`UPDATE points_adjustments a SET team_id=t.id, points=$3, reason=$4, updated_at=NOW() FROM teams t
      WHERE a.id=$2 AND a.league_id=$1 AND t.id=$5 AND t.league_id=$1 RETURNING a.*`, [req.admin.leagueId, req.params.id, req.body.points, req.body.reason.trim(), req.body.team_id])
    if (!adjustment) return res.status(404).json({ error: 'Adjustment or team not found in the active league' })
    res.json({ success: true, data: adjustment })
  } catch (error) { next(error) }
})
router.delete('/adjustments/:id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid adjustment ID' })
  try {
    const { rowCount } = await db.query('DELETE FROM points_adjustments WHERE id=$1 AND league_id=$2', [req.params.id, req.admin.leagueId])
    if (!rowCount) return res.status(404).json({ error: 'Adjustment not found' })
    res.json({ success: true, data: null })
  } catch (error) { next(error) }
})
module.exports = router
