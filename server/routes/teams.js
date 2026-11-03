const express = require('express')
const multer = require('multer')
const db = require('../db')
const auth = require('../middleware/authMiddleware')
const { validName, fail } = require('../services/rosters')
const { integer } = require('../services/rules')
const { normalizeLogo, storeLogo, removeLogo, storageRoot } = require('../services/logos')
const router = express.Router()
router.use(auth)
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1,fields:0,parts:2}}).single('logo')

router.get('/roster-settings',async(req,res,next)=>{
  try { const {rows:[settings]}=await db.query('SELECT max_roster_size FROM league_rules WHERE league_id=$1',[req.admin.leagueId]);res.json({success:true,data:settings}) } catch(error){next(error)}
})
router.put('/roster-settings',async(req,res,next)=>{
  const limit=req.body.max_roster_size
  if(limit!==null && !integer(limit,1,1000))return res.status(400).json({error:'Roster limit must be unlimited or an integer between 1 and 1000'})
  try {const {rows:[settings]}=await db.query('UPDATE league_rules SET max_roster_size=$2 WHERE league_id=$1 RETURNING max_roster_size',[req.admin.leagueId,limit]);res.json({success:true,data:settings})}catch(error){next(error)}
})
router.get('/',async(req,res,next)=>{
  try{
    const {rows}=await db.query(`SELECT t.id,t.name,t.logo_key,(SELECT count(*)::int FROM players p WHERE p.team_id=t.id AND p.league_id=t.league_id) AS player_count FROM teams t WHERE t.league_id=$1 ORDER BY t.name,t.id`,[req.admin.leagueId])
    res.json({success:true,data:rows})
  }catch(error){next(error)}
})
router.post('/',async(req,res,next)=>{
  if(!validName(req.body.name))return res.status(400).json({error:'Team name must be between 1 and 100 characters'})
  try{
    const {rows:[team]}=await db.query('INSERT INTO teams (league_id,name) VALUES ($1,$2) RETURNING *',[req.admin.leagueId,req.body.name.trim()])
    res.status(201).json({success:true,data:team})
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'A team with that name already exists'});next(error)}
})
router.put('/:id',async(req,res,next)=>{
  if(!/^\d+$/.test(req.params.id)||!validName(req.body.name))return res.status(400).json({error:'Choose a team and a name between 1 and 100 characters'})
  try{
    const {rows:[team]}=await db.query('UPDATE teams SET name=$1 WHERE id=$2 AND league_id=$3 RETURNING *',[req.body.name.trim(),req.params.id,req.admin.leagueId])
    if(!team)return res.status(404).json({error:'Team not found'})
    res.json({success:true,data:team})
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'A team with that name already exists'});next(error)}
})
async function ownedTeam(req,res,next){
  if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:'Invalid team ID'})
  try{const {rowCount}=await db.query('SELECT 1 FROM teams WHERE id=$1 AND league_id=$2',[req.params.id,req.admin.leagueId]);if(!rowCount)return res.status(404).json({error:'Team not found'});next()}catch(error){next(error)}
}
router.put('/:id/logo',ownedTeam,(req,res,next)=>{
  try{storageRoot()}catch(error){return next(error)}
  upload(req,res,error=>{if(error)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code==='LIMIT_FILE_SIZE'?'Team logos must be 2 MB or smaller':'Upload exactly one logo file, with no additional form fields'});next()})
},async(req,res,next)=>{
  let client,key,oldKey,committed=false
  try{
    const image=await normalizeLogo(req.file)
    client=await db.pool.connect();await client.query('BEGIN')
    const {rows:[team]}=await client.query('SELECT logo_key FROM teams WHERE id=$1 AND league_id=$2 FOR UPDATE',[req.params.id,req.admin.leagueId])
    if(!team)throw fail(404,'Team not found')
    oldKey=team.logo_key;key=await storeLogo(image)
    const {rows:[saved]}=await client.query('UPDATE teams SET logo_key=$3 WHERE id=$1 AND league_id=$2 RETURNING id,name,logo_key',[req.params.id,req.admin.leagueId,key])
    await client.query('COMMIT');committed=true
    await removeLogo(oldKey)
    res.json({success:true,data:saved})
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});if(key&&!committed)await removeLogo(key);next(error)}finally{client?.release()}
})
router.delete('/:id/logo',ownedTeam,async(req,res,next)=>{
  let client,oldKey
  try{
    client=await db.pool.connect();await client.query('BEGIN')
    const {rows:[team]}=await client.query('SELECT logo_key FROM teams WHERE id=$1 AND league_id=$2 FOR UPDATE',[req.params.id,req.admin.leagueId])
    if(!team)throw fail(404,'Team not found')
    oldKey=team.logo_key
    const {rows:[saved]}=await client.query('UPDATE teams SET logo_key=NULL WHERE id=$1 AND league_id=$2 RETURNING id,name,logo_key',[req.params.id,req.admin.leagueId])
    await client.query('COMMIT');await removeLogo(oldKey);res.json({success:true,data:saved})
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});next(error)}finally{client?.release()}
})
router.delete('/:id',async(req,res,next)=>{
  if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:'Invalid team ID'})
  try{
    const {rows:[team]}=await db.query('DELETE FROM teams WHERE id=$1 AND league_id=$2 RETURNING logo_key',[req.params.id,req.admin.leagueId])
    if(!team)return res.status(404).json({error:'Team not found'})
    await removeLogo(team.logo_key);res.json({success:true,data:null})
  }catch(error){if(error.code==='23503')return res.status(409).json({error:'This team has fixtures or recorded goals. Remove the relevant fixtures first; historical data will not be deleted automatically.'});next(error)}
})
module.exports=router
