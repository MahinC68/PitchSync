const router = require('express').Router()
const db = require('../db')
const auth = require('../middleware/authMiddleware')
const { normalizeLogo, storeLogo, removeLogo } = require('../services/logos')
const { fail } = require('../services/rosters')

// Public identity contains no access code or account information.
router.get('/league/:id',async(req,res,next) => {
  if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id)<1 || Number(req.params.id)>2147483647) return res.status(400).json({error:'Invalid league ID'})
  try {
    const { rows:[league] } = await db.query('SELECT id,name,logo_key FROM leagues WHERE id=$1',[req.params.id])
    if (!league) throw fail(404,'League not found')
    res.json({success:true,data:league})
  } catch(error) { next(error) }
})
router.use(auth)
router.put('/logo',require('../middleware/logoUpload')('League'),async(req,res,next) => {
  let client,key,committed=false
  try {
    const image = await normalizeLogo(req.file,'League')
    client = await db.pool.connect();await client.query('BEGIN')
    const { rows:[league] } = await client.query('SELECT logo_key FROM leagues WHERE id=$1 FOR UPDATE',[req.admin.leagueId])
    if (!league) throw fail(404,'League not found')
    key = await storeLogo(image,'League')
    const { rows:[saved] } = await client.query('UPDATE leagues SET logo_key=$2 WHERE id=$1 RETURNING id,name,logo_key',[req.admin.leagueId,key])
    await client.query('COMMIT');committed=true
    await removeLogo(league.logo_key)
    res.json({success:true,data:saved})
  } catch(error) {
    if(client)await client.query('ROLLBACK').catch(()=>{})
    if(key&&!committed)await removeLogo(key)
    next(error)
  } finally { client?.release() }
})
router.delete('/logo',async(req,res,next) => {
  let client
  try {
    client=await db.pool.connect();await client.query('BEGIN')
    const { rows:[league] }=await client.query('SELECT logo_key FROM leagues WHERE id=$1 FOR UPDATE',[req.admin.leagueId])
    if(!league)throw fail(404,'League not found')
    const { rows:[saved] }=await client.query('UPDATE leagues SET logo_key=NULL WHERE id=$1 RETURNING id,name,logo_key',[req.admin.leagueId])
    await client.query('COMMIT');await removeLogo(league.logo_key)
    res.json({success:true,data:saved})
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});next(error)}finally{client?.release()}
})
module.exports=router
