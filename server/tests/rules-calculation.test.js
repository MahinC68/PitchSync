const { calculateStandings } = require('../services/standings')
const { DEFAULT_RULES } = require('../services/rules')
const teams = [1, 2, 3, 4].map(id => ({ id, name: `Team ${id}` }))
const match = (id, home, away, hs, as, extra = {}) => ({ id, home_team_id: home, away_team_id: away, home_score: hs, away_score: as, date: '2026-01-01', status: 'completed', ...extra })
const row = (table, id) => table.find(team => team.teamId === id)
const order = ['head_to_head', 'goal_difference', 'goals_scored', 'total_wins']

test('default 3/1/0 and zero-match teams retain valid totals', () => {
  const table = calculateStandings(teams, [match(1, 1, 2, 2, 0), match(2, 1, 3, 1, 1)])
  expect(row(table, 1)).toMatchObject({ pts: 4, basePts: 4, w: 1, d: 1, mp: 2, gf: 3, ga: 1, recentPoints: 4 })
  expect(row(table, 2)).toMatchObject({ pts: 0, l: 1 })
  expect(row(table, 4)).toMatchObject({ pts: 0, mp: 0, recentPoints: 0 })
})
test('alternative signed scoring also changes recent form points', () => {
  const rules = { ...DEFAULT_RULES, win_points: 5, draw_points: 2, loss_points: -1 }
  const table = calculateStandings(teams, [match(1, 1, 2, 2, 0), match(2, 1, 3, 1, 1)], [], rules)
  expect(row(table, 1)).toMatchObject({ pts: 7, recentPoints: 7 })
  expect(row(table, 2).pts).toBe(-1)
})
test('changing criterion order changes the order without changing totals', () => {
  const matches = [match(1,1,3,1,0), match(2,1,4,0,5), match(3,2,3,1,1), match(4,2,4,1,1), match(5,2,3,1,1)]
  const standard = calculateStandings(teams, matches)
  const winsFirst = calculateStandings(teams, matches, [], { ...DEFAULT_RULES, tiebreakers: ['total_wins','goal_difference','goals_scored','head_to_head'] })
  expect(row(standard, 1).pts).toBe(row(standard, 2).pts)
  expect(row(standard, 2).position).toBeLessThan(row(standard, 1).position)
  expect(row(winsFirst, 1).position).toBeLessThan(row(winsFirst, 2).position)
})
test('goals scored and goal difference can independently be prioritized', () => {
  const matches = [match(1,1,3,2,0), match(2,2,4,5,4)]
  const gd = calculateStandings(teams, matches)
  const gf = calculateStandings(teams, matches, [], { ...DEFAULT_RULES, tiebreakers: ['goals_scored','goal_difference','total_wins','head_to_head'] })
  expect(row(gd,1).position).toBeLessThan(row(gd,2).position)
  expect(row(gf,2).position).toBeLessThan(row(gf,1).position)
})
test('two-team H2H excludes games against teams outside the tied group', () => {
  const matches = [match(1,1,2,1,0), match(2,1,4,0,2), match(3,2,4,5,0), match(4,4,3,1,0)]
  const table = calculateStandings(teams, matches, [], { ...DEFAULT_RULES, tiebreakers: order })
  expect(row(table,1).pts).toBe(row(table,2).pts)
  expect(row(table,1).gd).toBeLessThan(row(table,2).gd)
  expect(row(table,1).position).toBeLessThan(row(table,2).position)
})
test('multi-team H2H reapplies a mini-table to a remaining tied subgroup', () => {
  // A=2 beats B=1 2–0; B beats C 3–0; C beats A 2–1.
  // A and B have identical mini-table points/GD/GF; direct H2H must put A first.
  const table = calculateStandings(teams.slice(0,3), [match(1,2,1,2,0), match(2,1,3,3,0), match(3,3,2,2,1)], [], { ...DEFAULT_RULES, tiebreakers: order })
  expect(table.map(team => team.teamId)).toEqual([2,1,3])
})
test('circular three-way H2H ties terminate in deterministic team ID order', () => {
  const matches = [match(1,1,2,1,0),match(2,2,3,1,0),match(3,3,1,1,0)]
  const table = calculateStandings([...teams.slice(0,3)].reverse(), matches.reverse(), [], { ...DEFAULT_RULES, tiebreakers: order })
  expect(table.map(team => team.teamId)).toEqual([1,2,3])
})
test('head-to-head uses aggregate results over multiple meetings', () => {
  const table = calculateStandings(teams.slice(0,2), [match(1,1,2,1,0),match(2,2,1,2,0)], [], { ...DEFAULT_RULES, tiebreakers: order })
  expect(table.map(team => team.teamId)).toEqual([2,1])
})
test('manual adjustments and one forfeit penalty are independent from match points', () => {
  const matches = [match(1,1,2,2,1, { forfeit_team_id: 1, forfeit_home_score: 0, forfeit_away_score: 3, forfeit_penalty: 2 })]
  const table = calculateStandings(teams, matches, [{ team_id: 1, points: -3 },{ team_id: 1, points: 1 }])
  expect(row(table,1)).toMatchObject({ pts: -4, basePts: 0, manualAdjustment: -2, forfeitPenalty: 2, netAdjustment: -4, gf: 0, ga: 3, l: 1 })
  expect(row(table,2)).toMatchObject({ pts: 3, gf: 3, w: 1 })
  expect(matches[0].home_score).toBe(2)
})
test('head-to-head counts awarded forfeit outcomes, not preserved original scores', () => {
  const matches = [match(1,1,2,5,0, { forfeit_team_id: 1, forfeit_home_score: 0, forfeit_away_score: 3, forfeit_penalty: 0 })]
  const table = calculateStandings(teams.slice(0,2), matches, [{ team_id: 1, points: 3 }], { ...DEFAULT_RULES, tiebreakers: order })
  expect(table.map(team => team.teamId)).toEqual([2,1])
})
test('unplayed or invalid scores never create fictional points', () => {
  const table = calculateStandings(teams, [match(1,1,2,0,0, { status:'scheduled' }),match(2,1,2,null,null)])
  expect(table.every(team => team.mp === 0 && team.pts === 0)).toBe(true)
})
