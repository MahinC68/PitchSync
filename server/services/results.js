const db = require('../db')
const { integer } = require('./rules')
const { lockRosters, createLockedPlayer, validName, fail } = require('./rosters')

async function saveResult(leagueId, matchId, homeScore, awayScore, scorers) {
  if (!integer(homeScore,0,99) || !integer(awayScore,0,99)) throw fail(400,'Scores must be integers between 0 and 99')
  if (scorers !== undefined && (!Array.isArray(scorers) || scorers.length > homeScore + awayScore)) throw fail(400,'Invalid scorer entries')
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [initial] } = await client.query('SELECT home_team_id,away_team_id FROM matches WHERE id=$1 AND league_id=$2',[matchId,leagueId])
    if (!initial) throw fail(404,'Fixture not found')
    const roster = await lockRosters(client,leagueId,[initial.home_team_id,initial.away_team_id])
    const { rows: [match] } = await client.query('SELECT * FROM matches WHERE id=$1 AND league_id=$2 FOR UPDATE',[matchId,leagueId])
    if (!match) throw fail(404,'Fixture not found')
    if (match.forfeit_team_id != null) throw fail(409,'Clear the forfeit before editing the original result')
    const resolved = [], count = new Map()
    for (const scorer of scorers || []) {
      if (!scorer || ![match.home_team_id,match.away_team_id].includes(scorer.team_id)) throw fail(403,'Scorer team must belong to this match')
      const total = (count.get(scorer.team_id) || 0) + 1
      if (total > (scorer.team_id === match.home_team_id ? homeScore : awayScore)) throw fail(400,'Scorer count cannot exceed the team score')
      count.set(scorer.team_id,total)
      let player
      if (scorer.new_name !== undefined) {
        if (scorer.player_id !== undefined || !validName(scorer.new_name)) throw fail(400,'Invalid new scorer name')
        player = await createLockedPlayer(client,leagueId,scorer.team_id,scorer.new_name,roster,true)
      } else {
        if (!integer(scorer.player_id,1,2147483647)) throw fail(400,'Invalid scorer ID')
        const result = await client.query('SELECT id FROM players WHERE id=$1 AND team_id=$2 AND league_id=$3 FOR KEY SHARE',[scorer.player_id,scorer.team_id,leagueId])
        player = result.rows[0]
        if (!player) throw fail(403,'Scorer must belong to this team and league')
      }
      resolved.push({ team:scorer.team_id, player:player.id })
    }
    const { rows: [saved] } = await client.query("UPDATE matches SET home_score=$1,away_score=$2,status='completed' WHERE id=$3 AND league_id=$4 RETURNING *",[homeScore,awayScore,matchId,leagueId])
    if (scorers !== undefined) {
      await client.query('DELETE FROM goals WHERE match_id=$1',[matchId])
      for (const scorer of resolved) await client.query('INSERT INTO goals (match_id,player_id,team_id) VALUES ($1,$2,$3)',[matchId,scorer.player,scorer.team])
    }
    await client.query('COMMIT')
    return saved
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error } finally { client.release() }
}
module.exports = { saveResult }
