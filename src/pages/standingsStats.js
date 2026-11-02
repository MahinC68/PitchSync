export const QUICK_OPTIONS = [
  { id: 'goals', label: 'Most goals', description: 'Highest total goals scored' },
  { id: 'defense', label: 'Best defense', description: 'Fewest goals conceded per match' },
  { id: 'difference', label: 'Best goal difference', description: 'Goals scored minus goals conceded' },
  { id: 'form', label: 'Best recent form', description: 'Points from the last five matches' },
  { id: 'wins', label: 'Most wins', description: 'Highest number of wins' },
  { id: 'winRate', label: 'Best win rate', description: 'Wins as a percentage of matches played' },
  { id: 'attack', label: 'Best scoring rate', description: 'Goals scored per match' },
  { id: 'pointsRate', label: 'Best points per match', description: 'Points earned per match played' },
  { id: 'losses', label: 'Fewest defeats', description: 'Fewest losses among teams that have played' },
]
export const LEAGUE_OPTIONS = [
  { id: 'teams', label: 'Teams competing', description: 'All teams registered in this league' },
  { id: 'goals', label: 'Goals scored', description: 'Total goals across completed matches' },
  { id: 'matches', label: 'Matches played', description: 'Total completed league matches' },
  { id: 'goalsRate', label: 'Goals per match', description: 'Average goals per completed match' },
  { id: 'draws', label: 'Drawn matches', description: 'Completed matches that ended level' },
  { id: 'drawRate', label: 'Draw rate', description: 'Percentage of completed matches drawn' },
  { id: 'decisive', label: 'Decisive matches', description: 'Completed matches with a winner' },
  { id: 'points', label: 'Points awarded', description: 'Total points earned by all teams' },
  { id: 'gap', label: 'Lead at the top', description: 'Points separating first and second' },
]
export const DEFAULT_QUICK = ['goals', 'defense', 'difference', 'form']
export const DEFAULT_LEAGUE = ['teams', 'goals']

export function quickStat(id, standings) {
  const option = QUICK_OPTIONS.find(option => option.id === id)
  const played = standings.filter(team => team.mp > 0)
  if (!played.length) return { ...option, value: '—', sub: 'Awaiting the first result' }
  const formPoints = team => team.form.reduce((sum, result) => sum + (result === 'W' ? 3 : result === 'D' ? 1 : 0), 0)
  const configs = {
    goals: [team => team.gf, false, team => `${team.gf} goals scored`],
    defense: [team => team.ga / team.mp, true, team => `${(team.ga / team.mp).toFixed(2)} conceded / match`],
    difference: [team => team.gd, false, team => `${team.gd > 0 ? '+' : ''}${team.gd} goal difference`],
    form: [formPoints, false, team => `${formPoints(team)} pts · last ${team.form.length} matches`],
    wins: [team => team.w, false, team => `${team.w} wins`],
    winRate: [team => team.w / team.mp, false, team => `${Math.round(team.w / team.mp * 100)}% · ${team.mp} played`],
    attack: [team => team.gf / team.mp, false, team => `${(team.gf / team.mp).toFixed(2)} goals / match`],
    pointsRate: [team => team.pts / team.mp, false, team => `${(team.pts / team.mp).toFixed(2)} points / match`],
    losses: [team => team.l, true, team => `${team.l} defeats · ${team.mp} played`],
  }
  const [score, lowest, detail] = configs[id]
  const sorted = [...played].sort((a, b) => lowest ? score(a) - score(b) : score(b) - score(a))
  const first = sorted[0]
  const tied = sorted.filter(team => Math.abs(score(team) - score(first)) < 1e-9)
  return { ...option, value: first.teamName, tied: tied.length > 1 ? `+${tied.length - 1} tied` : '', title: tied.map(team => team.teamName).join(', '), sub: detail(first) }
}

export function leagueStats(standings) {
  const sum = key => standings.reduce((total, team) => total + Number(team[key]), 0)
  const matches = sum('mp') / 2
  const goals = sum('gf')
  const draws = sum('d') / 2
  return {
    teams: { value: standings.length, sub: 'Registered in this league' },
    goals: { value: goals, sub: 'Across completed matches' },
    matches: { value: matches, sub: 'Completed league matches' },
    goalsRate: { value: matches ? (goals / matches).toFixed(2) : '—', sub: 'Average per completed match' },
    draws: { value: draws, sub: 'Matches that finished level' },
    drawRate: { value: matches ? `${Math.round(draws / matches * 100)}%` : '—', sub: 'Of completed matches' },
    decisive: { value: matches - draws, sub: 'Matches with a winner' },
    points: { value: sum('pts'), sub: 'Earned across all teams' },
    gap: { value: matches && standings.length > 1 ? standings[0].pts - standings[1].pts : '—', sub: 'Points between first and second' },
  }
}

export function readStatsPreferences(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key))
    const quick = [...new Set(saved?.quick)].filter(id => QUICK_OPTIONS.some(option => option.id === id)).slice(0, 4)
    const league = [...new Set(saved?.league)].filter(id => LEAGUE_OPTIONS.some(option => option.id === id)).slice(0, 2)
    return { quick: quick.length ? quick : DEFAULT_QUICK, league: league.length === 2 ? league : DEFAULT_LEAGUE }
  } catch { return { quick: DEFAULT_QUICK, league: DEFAULT_LEAGUE } }
}
