const crypto = require('crypto')
const db = require('../db')
const { readStandings } = require('./standings')
const { integer } = require('./rules')
const { fail } = require('./rosters')

const SEEDING = { 2: [[1,2]], 4: [[1,4],[2,3]], 8: [[1,8],[4,5],[2,7],[3,6]] }
function settingsFrom(rules) {
  return { enabled: rules.playoffs_enabled ?? false, qualifiers: rules.playoffs_qualifiers ?? 4, third_place: rules.playoffs_third_place ?? false }
}
function matchLabel(match, rounds) {
  if (match.kind === 'third') return 'Third-place match'
  const name = match.round === rounds ? 'Final' : match.round === rounds - 1 ? 'Semifinal' : 'Quarterfinal'
  return match.round === rounds ? name : `${name} ${match.position}`
}
async function transaction(work, isolation = '') {
  const client = await db.pool.connect()
  try {
    await client.query(`BEGIN ${isolation}`)
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (['40001','40P01'].includes(error.code)) throw fail(409,'The competition changed during this request. Refresh and try again.')
    throw error
  } finally { client.release() }
}
async function getBracket(client, leagueId) {
  const { rows: [bracket] } = await client.query('SELECT * FROM playoff_brackets WHERE league_id=$1',[leagueId])
  if (!bracket) return null
  const { rows: entries } = await client.query(`SELECT e.seed,e.team_id,t.name,t.logo_key FROM playoff_entries e JOIN teams t ON t.id=e.team_id AND t.league_id=e.league_id WHERE e.bracket_id=$1 ORDER BY e.seed`,[bracket.id])
  const { rows: matches } = await client.query('SELECT * FROM playoff_matches WHERE bracket_id=$1 AND league_id=$2 ORDER BY round,kind,position',[bracket.id,leagueId])
  const rounds = Math.log2(bracket.qualifiers)
  const final = matches.find(match => match.kind === 'main' && match.round === rounds)
  return { ...bracket, entries, matches: matches.map(match => ({ ...match, label: matchLabel(match,rounds) })), champion_id: final?.winner_id ?? null, completed: matches.every(match => match.winner_id != null) }
}
async function readCompetition(leagueId) {
  return transaction(async client => {
    const { rows: [league] } = await client.query('SELECT id FROM leagues WHERE id=$1',[leagueId])
    if (!league) throw fail(404,'League not found')
    const { rows: [rules] } = await client.query('SELECT * FROM league_rules WHERE league_id=$1',[leagueId])
    return { settings: settingsFrom(rules || {}), bracket: await getBracket(client,leagueId) }
  },'ISOLATION LEVEL REPEATABLE READ READ ONLY')
}
async function saveSettings(leagueId, body) {
  if (!body || typeof body.enabled !== 'boolean' || ![2,4,8].includes(body.qualifiers) || typeof body.third_place !== 'boolean' || (body.third_place && body.qualifiers === 2) || Object.keys(body).some(key => !['enabled','qualifiers','third_place'].includes(key))) throw fail(400,'Choose enabled/disabled, 2, 4 or 8 qualifiers, and a third-place match only for 4 or 8 teams')
  const { rows: [rules] } = await db.query('UPDATE league_rules SET playoffs_enabled=$2,playoffs_qualifiers=$3,playoffs_third_place=$4 WHERE league_id=$1 RETURNING *',[leagueId,body.enabled,body.qualifiers,body.third_place])
  return settingsFrom(rules)
}
async function makePreview(client, leagueId) {
  const { rows: [existing] } = await client.query('SELECT id FROM playoff_brackets WHERE league_id=$1',[leagueId])
  if (existing) throw fail(409,'This league already has a playoff bracket. View the existing bracket to manage its results.')
  const { rules, standings } = await readStandings(client,leagueId)
  const settings = settingsFrom(rules)
  if (!settings.enabled) throw fail(409,'Enable playoffs before generating a bracket')
  if (settings.third_place && settings.qualifiers === 2) throw fail(400,'A third-place match needs at least four qualifiers')
  if (standings.length < settings.qualifiers) throw fail(409,`At least ${settings.qualifiers} teams are required; this league has ${standings.length}`)
  const entries = standings.slice(0,settings.qualifiers).map(team => ({ seed:team.position, team_id:team.teamId, name:team.teamName, logo_key:team.teamLogo, points:team.pts }))
  const matchups = SEEDING[settings.qualifiers].map(([home,away],index) => ({ position:index+1, home:entries[home-1], away:entries[away-1] }))
  const token = crypto.createHash('sha256').update(JSON.stringify({ settings, standings })).digest('hex')
  return { settings, entries, matchups, token }
}
async function previewBracket(leagueId) {
  return transaction(client => makePreview(client,leagueId),'ISOLATION LEVEL REPEATABLE READ READ ONLY')
}
async function generateBracket(leagueId, token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw fail(400,'Preview the bracket before saving it')
  return transaction(async client => {
    // Serialize generation/settings changes, and read one consistent standings snapshot.
    await client.query('SELECT league_id FROM league_rules WHERE league_id=$1 FOR UPDATE',[leagueId])
    const preview = await makePreview(client,leagueId)
    if (preview.token !== token) throw fail(409,'Standings or playoff settings changed. Preview the bracket again before saving.')
    const { settings, entries, matchups } = preview
    let bracket
    try {
      const result = await client.query('INSERT INTO playoff_brackets(league_id,qualifiers,third_place) VALUES($1,$2,$3) RETURNING *',[leagueId,settings.qualifiers,settings.third_place])
      bracket = result.rows[0]
    } catch (error) { if (error.code === '23505') throw fail(409,'This league already has a playoff bracket. View the existing bracket.'); throw error }
    for (const entry of entries) await client.query('INSERT INTO playoff_entries(bracket_id,league_id,team_id,seed) VALUES($1,$2,$3,$4)',[bracket.id,leagueId,entry.team_id,entry.seed])
    const rounds = Math.log2(settings.qualifiers)
    for (let round=1;round<=rounds;round++) {
      for (let position=1;position<=settings.qualifiers / 2 ** round;position++) {
        const seed = round === 1 ? matchups[position-1] : null
        await client.query('INSERT INTO playoff_matches(bracket_id,league_id,round,position,home_team_id,away_team_id) VALUES($1,$2,$3,$4,$5,$6)',[bracket.id,leagueId,round,position,seed?.home.team_id ?? null,seed?.away.team_id ?? null])
      }
    }
    if (settings.third_place) await client.query("INSERT INTO playoff_matches(bracket_id,league_id,round,position,kind) VALUES($1,$2,$3,1,'third')",[bracket.id,leagueId,rounds])
    return getBracket(client,leagueId)
  },'ISOLATION LEVEL REPEATABLE READ')
}
function clearResult(match) { match.home_score=null;match.away_score=null;match.winner_id=null;match.penalty_winner_id=null }
function propagate(matches, rounds) {
  const affected = []
  const main = (round,position) => matches.find(match => match.kind === 'main' && match.round === round && match.position === position)
  const loser = match => !match?.winner_id ? null : match.winner_id === match.home_team_id ? match.away_team_id : match.home_team_id
  for (const match of matches.filter(match => match.round > 1).sort((a,b) => a.round-b.round || a.kind.localeCompare(b.kind))) {
    const a = main(match.round-1,match.kind === 'third' ? 1 : match.position*2-1)
    const b = main(match.round-1,match.kind === 'third' ? 2 : match.position*2)
    const home = match.kind === 'third' ? loser(a) : a?.winner_id ?? null
    const away = match.kind === 'third' ? loser(b) : b?.winner_id ?? null
    if (home !== match.home_team_id || away !== match.away_team_id) {
      if (match.winner_id != null) affected.push({ id:match.id, label:matchLabel(match,rounds) })
      clearResult(match);match.home_team_id=home;match.away_team_id=away
    }
  }
  return affected
}
async function recordResult(leagueId, matchId, body, clear = false) {
  if (!body || !integer(body.expected_revision,1,2147483647)) throw fail(400,'A current bracket revision is required. Refresh the bracket.')
  if (Object.keys(body).some(key => !['expected_revision','home_score','away_score','penalty_winner_id','reset_match_ids'].includes(key))) throw fail(400,'Only playoff scores, a penalty winner and explicit dependent-result resolution are supported')
  if (body.reset_match_ids !== undefined && (!Array.isArray(body.reset_match_ids) || !body.reset_match_ids.every(id=>integer(id,1,2147483647)) || new Set(body.reset_match_ids).size !== body.reset_match_ids.length)) throw fail(400,'Invalid dependent-result resolution')
  return transaction(async client => {
    const { rows: [bracket] } = await client.query('SELECT * FROM playoff_brackets WHERE league_id=$1 FOR UPDATE',[leagueId])
    if (!bracket) throw fail(404,'Playoff bracket not found')
    if (bracket.revision !== body.expected_revision) { const error=fail(409,'The bracket has changed. Close this editor and refresh before saving.');error.code='STALE_BRACKET';throw error }
    const { rows: matches } = await client.query('SELECT * FROM playoff_matches WHERE bracket_id=$1 AND league_id=$2 ORDER BY round,kind,position',[bracket.id,leagueId])
    const match = matches.find(match => match.id === matchId)
    if (!match) throw fail(404,'Playoff match not found')
    if (clear) clearResult(match)
    else {
      if (!match.home_team_id || !match.away_team_id) throw fail(409,'Both teams must advance before this match can have a result')
      const { home_score:home, away_score:away } = body
      if (!integer(home,0,99) || !integer(away,0,99)) throw fail(400,'Scores must be integers between 0 and 99')
      const penalty = body.penalty_winner_id ?? null
      if (home === away && ![match.home_team_id,match.away_team_id].includes(penalty)) throw fail(400,'Choose the penalty-shootout winner for a drawn knockout match')
      if (home !== away && penalty !== null) throw fail(400,'Only drawn matches can have a penalty-shootout winner')
      match.home_score=home;match.away_score=away;match.penalty_winner_id=penalty
      match.winner_id=home>away?match.home_team_id:away>home?match.away_team_id:penalty
    }
    const affected = propagate(matches,Math.log2(bracket.qualifiers))
    const supplied = [...(body.reset_match_ids || [])].sort((a,b)=>a-b)
    const expected = affected.map(match=>match.id).sort((a,b)=>a-b)
    if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
      const error=fail(409,affected.length?'This change affects completed later matches. Explicitly clear their results to continue.':'Dependent matches changed. Refresh the bracket and try again.')
      error.code='DOWNSTREAM_RESULTS';error.details={ affected, revision:bracket.revision };throw error
    }
    for (const row of matches) await client.query('UPDATE playoff_matches SET home_team_id=$3,away_team_id=$4,home_score=$5,away_score=$6,winner_id=$7,penalty_winner_id=$8 WHERE id=$1 AND league_id=$2',[row.id,leagueId,row.home_team_id,row.away_team_id,row.home_score,row.away_score,row.winner_id,row.penalty_winner_id])
    await client.query('UPDATE playoff_brackets SET revision=revision+1 WHERE id=$1',[bracket.id])
    return getBracket(client,leagueId)
  })
}
module.exports = { settingsFrom, readCompetition, saveSettings, previewBracket, generateBracket, recordResult }
