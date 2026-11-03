const { DEFAULT_RULES } = require('./rules')
function effectiveScore(match) {
  return match.forfeit_team_id == null ? [match.home_score, match.away_score] : [match.forfeit_home_score, match.forfeit_away_score]
}
function outcomePoints(gf, ga, rules) { return gf > ga ? rules.win_points : gf === ga ? rules.draw_points : rules.loss_points }
function partitions(teams, key) {
  const groups = new Map()
  for (const team of teams) { const value = key(team); if (!groups.has(value)) groups.set(value, []); groups.get(value).push(team) }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, group]) => group)
}

// Rank whole tied groups, never pairwise H2H comparisons (which can be non-transitive).
function rankTied(teams, criteria, index, matches, rules) {
  if (teams.length < 2) return teams
  if (index === criteria.length) return [...teams].sort((a, b) => a.teamId - b.teamId)
  const criterion = criteria[index]
  if (criterion !== 'head_to_head') {
    const field = { goal_difference: 'gd', goals_scored: 'gf', total_wins: 'w' }[criterion]
    return partitions(teams, team => team[field]).flatMap(group => rankTied(group, criteria, index + 1, matches, rules))
  }
  const mini = new Map(teams.map(team => [team.teamId, { pts: 0, gd: 0, gf: 0 }]))
  for (const match of matches) {
    if (!mini.has(match.home_team_id) || !mini.has(match.away_team_id)) continue
    const [home, away] = effectiveScore(match)
    const a = mini.get(match.home_team_id), b = mini.get(match.away_team_id)
    a.pts += outcomePoints(home, away, rules); b.pts += outcomePoints(away, home, rules)
    a.gf += home; b.gf += away; a.gd += home - away; b.gd += away - home
  }
  let groups = [teams]
  for (const field of ['pts', 'gd', 'gf']) groups = groups.flatMap(group => partitions(group, team => mini.get(team.teamId)[field]))
  // If the mini-table splits a group, reapply H2H to smaller tied subgroups.
  // If it cannot split the group, move on; this guarantees termination.
  return groups.flatMap(group => rankTied(group, criteria, groups.length > 1 ? index : index + 1, matches, rules))
}

function calculateStandings(teams, allMatches, adjustments = [], rules = DEFAULT_RULES) {
  const table = new Map(teams.map(team => [team.id, { teamId: team.id, teamName: team.name, teamLogo: team.logo_key ?? null,
    mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, basePts: 0, manualAdjustment: 0, forfeitPenalty: 0, forfeits: 0, netAdjustment: 0, pts: 0, form: [], recentPoints: 0 }]))
  const matches = allMatches.filter(match => match.status === 'completed' && table.has(match.home_team_id) && table.has(match.away_team_id) && effectiveScore(match).every(Number.isInteger))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id)
  for (const match of matches) {
    const [home, away] = effectiveScore(match)
    for (const [id, gf, ga] of [[match.home_team_id, home, away], [match.away_team_id, away, home]]) {
      const team = table.get(id)
      team.mp++; team.gf += gf; team.ga += ga
      const result = gf > ga ? 'W' : gf === ga ? 'D' : 'L'
      team[result.toLowerCase()]++; team.form.push(result)
      team.basePts += outcomePoints(gf, ga, rules)
      if (match.forfeit_team_id === id) { team.forfeitPenalty += match.forfeit_penalty; team.forfeits++ }
    }
  }
  for (const adjustment of adjustments) { const team = table.get(adjustment.team_id); if (team) team.manualAdjustment += Number(adjustment.points) }
  for (const team of table.values()) {
    team.form = team.form.slice(-5)
    team.recentPoints = team.form.reduce((sum, result) => sum + rules[{ W: 'win_points', D: 'draw_points', L: 'loss_points' }[result]], 0)
    team.gd = team.gf - team.ga; team.netAdjustment = team.manualAdjustment - team.forfeitPenalty; team.pts = team.basePts + team.netAdjustment
  }
  return partitions([...table.values()], team => team.pts).flatMap(group => rankTied(group, rules.tiebreakers, 0, matches, rules))
    .map((team, index) => ({ ...team, position: index + 1 }))
}
module.exports = { calculateStandings, effectiveScore }
