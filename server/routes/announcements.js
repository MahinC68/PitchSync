const router = require('express').Router()
const db = require('../db')
const auth = require('../middleware/authMiddleware')
const { fail } = require('../services/rosters')
const validId = value => /^\d+$/.test(String(value)) && Number(value)>0 && Number(value)<=2147483647
function validate(body) {
  if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>!['title','message'].includes(key)))return false
  return [['title',120],['message',5000]].every(([key,max])=>typeof body[key]==='string'&&body[key].trim().length>0&&body[key].trim().length<=max)
}
router.get('/league/:id',async(req,res,next) => {
  const limit=Number(req.query.limit??20),offset=Number(req.query.offset??0)
  if(!validId(req.params.id)||!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0||offset>100000)return res.status(400).json({error:'Choose a valid league, page size (1–50) and offset (0–100000)'})
  try {
    if(!(await db.query('SELECT 1 FROM leagues WHERE id=$1',[req.params.id])).rowCount)throw fail(404,'League not found')
    const {rows:[data]}=await db.query(`WITH scoped AS (
      SELECT id,title,message,published_at FROM announcements WHERE league_id=$1
    ), page AS (SELECT * FROM scoped ORDER BY published_at DESC,id DESC LIMIT $2 OFFSET $3)
    SELECT (SELECT count(*)::int FROM scoped) AS total,
      COALESCE((SELECT jsonb_agg(page ORDER BY published_at DESC,id DESC) FROM page),'[]'::jsonb) AS items`,[req.params.id,limit,offset])
    const items=data.items.map(item=>({...item,published_at:new Date(item.published_at).toISOString()}))
    res.json({success:true,data:{...data,items,limit,offset}})
  } catch(error) { next(error) }
})
router.use(auth)
router.post('/',async(req,res,next) => {
  if(!validate(req.body))return res.status(400).json({error:'Provide only a title (1–120 characters) and message (1–5000 characters). The publication date is assigned when published.'})
  try {
    const {rows:[item]}=await db.query('INSERT INTO announcements(league_id,title,message) VALUES($1,$2,$3) RETURNING id,title,message,published_at',[req.admin.leagueId,req.body.title.trim(),req.body.message.trim()])
    res.status(201).json({success:true,data:item})
  }catch(error){next(error)}
})
router.put('/:id',async(req,res,next) => {
  if(!validId(req.params.id)||!validate(req.body))return res.status(400).json({error:'Provide a valid announcement, title (1–120 characters) and message (1–5000 characters)'})
  try {
    const {rows:[item]}=await db.query('UPDATE announcements SET title=$3,message=$4 WHERE id=$1 AND league_id=$2 RETURNING id,title,message,published_at',[req.params.id,req.admin.leagueId,req.body.title.trim(),req.body.message.trim()])
    if(!item)throw fail(404,'Announcement not found in the active league')
    res.json({success:true,data:item})
  }catch(error){next(error)}
})
router.delete('/:id',async(req,res,next) => {
  if(!validId(req.params.id))return res.status(400).json({error:'Invalid announcement ID'})
  try {
    const {rowCount}=await db.query('DELETE FROM announcements WHERE id=$1 AND league_id=$2',[req.params.id,req.admin.leagueId])
    if(!rowCount)throw fail(404,'Announcement not found in the active league')
    res.json({success:true,data:null})
  }catch(error){next(error)}
})
module.exports=router
