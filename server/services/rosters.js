const { integer } = require('./rules')
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100
function fail(status, message) { const error = new Error(message); error.status = status; return error }
async function lockRosters(client, leagueId, teamIds) {
  // All creation paths take locks in this order: rules, teams by ID, then players/match.
  const { rows: [rules] } = await client.query('SELECT max_roster_size FROM league_rules WHERE league_id=$1 FOR SHARE', [leagueId])
  const ids = [...new Set(teamIds)]
  const { rows: teams } = await client.query('SELECT id, name FROM teams WHERE league_id=$1 AND id=ANY($2::int[]) ORDER BY id FOR UPDATE', [leagueId, ids])
  if (teams.length !== ids.length) throw fail(403, 'Team must belong to the active league')
  return { limit: rules?.max_roster_size ?? null, teams: new Map(teams.map(team => [team.id, team])) }
}
async function createLockedPlayer(client, leagueId, teamId, name, roster, reuse = false) {
  if (!validName(name) || !integer(teamId,1,2147483647) || !roster.teams.has(teamId)) throw fail(400,'Choose a team and a player name (1–100 characters)')
  if (reuse) {
    const { rows: [existing] } = await client.query('SELECT * FROM players WHERE team_id=$1 AND league_id=$2 AND lower(name)=lower($3) ORDER BY id LIMIT 1',[teamId,leagueId,name.trim()])
    if (existing) return existing
  }
  if (roster.limit !== null) {
    const { rows: [{ count }] } = await client.query('SELECT count(*)::int AS count FROM players WHERE team_id=$1 AND league_id=$2', [teamId, leagueId])
    if (count >= roster.limit) throw fail(409, `${roster.teams.get(teamId).name} has reached its roster limit (${count}/${roster.limit}). Remove an eligible player or increase the league limit before adding another.`)
  }
  const { rows: [player] } = await client.query('INSERT INTO players (name,team_id,league_id) VALUES ($1,$2,$3) RETURNING *',[name.trim(),teamId,leagueId])
  return player
}
module.exports = { lockRosters, createLockedPlayer, validName, fail }
