const express        = require('express')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const { lockRosters, createLockedPlayer, validName, fail } = require('../services/rosters')
const { integer } = require('../services/rules')
const router = express.Router()

// ── GET /api/players/team/:team_id (admin only) ───────────────────────────────
// Must be registered before /:league_id/top-scorers to avoid param collision
router.get('/team/:team_id', authMiddleware, async (req, res) => {
  try {
    const owned = await db.query('SELECT 1 FROM teams WHERE id=$1 AND league_id=$2',[req.params.team_id,req.admin.leagueId])
    if(!owned.rowCount)return res.status(404).json({error:'Team not found'})
    const { rows } = await db.query(
      `SELECT id, name, team_id, EXISTS(SELECT 1 FROM goals WHERE player_id=players.id) AS has_goals FROM players
       WHERE  team_id = $1 AND league_id = $2
       ORDER  BY name ASC`,
      [req.params.team_id, req.admin.leagueId]
    )
    return res.json({ success: true, data: rows })
  } catch (err) {
    console.error('players/team GET:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── GET /api/players/:league_id/top-scorers ───────────────────────────────────
router.get('/:league_id/top-scorers', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         p.id,
         p.name  AS player_name,
         t.name  AS team_name,
         COUNT(g.id) AS goals
       FROM   players p
       JOIN   teams   t ON t.id = p.team_id
       LEFT JOIN goals g
         ON  g.player_id = p.id
         AND g.match_id IN (SELECT id FROM matches WHERE league_id = $1 AND forfeit_team_id IS NULL)
       WHERE  p.league_id = $1
       GROUP BY p.id, p.name, t.name
       ORDER  BY goals DESC, p.name ASC`,
      [req.params.league_id]
    )

    const data = rows.map((row, i) => ({
      rank:       i + 1,
      playerId:   row.id,
      playerName: row.player_name,
      teamName:   row.team_name,
      goals:      Number(row.goals),
    }))

    return res.json({ success: true, data })
  } catch (err) {
    console.error('top-scorers:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── POST /api/players (admin only) ───────────────────────────────────────────
router.post('/', authMiddleware, async(req,res,next)=>{
  if(!validName(req.body.name)||!integer(req.body.team_id,1,2147483647))return res.status(400).json({error:'Choose a team and a player name (1–100 characters)'})
  let client
  try{
    client=await db.pool.connect();await client.query('BEGIN')
    const roster=await lockRosters(client,req.admin.leagueId,[req.body.team_id])
    const player=await createLockedPlayer(client,req.admin.leagueId,req.body.team_id,req.body.name,roster)
    await client.query('COMMIT');res.status(201).json({success:true,data:player})
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});next(error)}finally{client?.release()}
})

router.put('/:id',authMiddleware,async(req,res,next)=>{
  if(!/^\d+$/.test(req.params.id)||!validName(req.body.name)||Object.keys(req.body).some(key=>key!=='name'))return res.status(400).json({error:'Provide only a player name (1–100 characters). Player transfers are not supported.'})
  try{
    const {rows:[player]}=await db.query('UPDATE players SET name=$1 WHERE id=$2 AND league_id=$3 RETURNING *',[req.body.name.trim(),req.params.id,req.admin.leagueId])
    if(!player)return res.status(404).json({error:'Player not found'})
    res.json({success:true,data:player})
  }catch(error){next(error)}
})

// ── DELETE /api/players/:id (admin only) ─────────────────────────────────────
router.delete('/:id',authMiddleware,async(req,res,next)=>{
  if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:'Invalid player ID'})
  let client
  try{
    client=await db.pool.connect();await client.query('BEGIN')
    const {rows:[player]}=await client.query('SELECT id FROM players WHERE id=$1 AND league_id=$2 FOR UPDATE',[req.params.id,req.admin.leagueId])
    if(!player)throw fail(404,'Player not found')
    const goals=await client.query('SELECT 1 FROM goals WHERE player_id=$1 LIMIT 1',[player.id])
    if(goals.rowCount)throw fail(409,'This player has recorded goals and cannot be deleted without losing historical attribution. Rename the player instead.')
    await client.query('DELETE FROM players WHERE id=$1 AND league_id=$2',[player.id,req.admin.leagueId])
    await client.query('COMMIT');res.json({success:true,data:null})
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});next(error)}finally{client?.release()}
})

module.exports=router
