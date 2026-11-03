const DEFAULT_RULES = Object.freeze({ win_points: 3, draw_points: 1, loss_points: 0,
  tiebreakers: ['goal_difference', 'goals_scored', 'total_wins', 'head_to_head'],
  match_duration: 90, forfeit_winner_score: 3, forfeit_loser_score: 0, forfeit_penalty: 0 })
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
function validateRules(rules) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return false
  return ['win_points', 'draw_points', 'loss_points'].every(key => integer(rules[key], -100, 100))
    && Array.isArray(rules.tiebreakers) && rules.tiebreakers.length === 4
    && new Set(rules.tiebreakers).size === 4 && rules.tiebreakers.every(key => DEFAULT_RULES.tiebreakers.includes(key))
    && integer(rules.match_duration, 1, 300) && integer(rules.forfeit_winner_score, 1, 99)
    && integer(rules.forfeit_loser_score, 0, 98) && rules.forfeit_winner_score > rules.forfeit_loser_score
    && integer(rules.forfeit_penalty, 0, 100)
}
async function getRules(db, leagueId, lock = false) {
  const { rows: [rules] } = await db.query(`SELECT * FROM league_rules WHERE league_id = $1${lock ? ' FOR SHARE' : ''}`, [leagueId])
  return rules || { league_id: Number(leagueId), ...DEFAULT_RULES }
}
module.exports = { DEFAULT_RULES, validateRules, getRules, integer }
