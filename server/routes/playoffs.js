const router = require('express').Router()
const auth = require('../middleware/authMiddleware')
const service = require('../services/playoffs')
const { integer } = require('../services/rules')
const { fail } = require('../services/rosters')
const route = handler => async(req,res,next) => { try { res.json({success:true,data:await handler(req)}) } catch(error){next(error)} }
router.get('/league/:id',route(req => {
  if (!integer(Number(req.params.id),1,2147483647)) throw fail(400,'Invalid league ID')
  return service.readCompetition(Number(req.params.id))
}))
router.use(auth)
router.put('/settings',route(req => service.saveSettings(req.admin.leagueId,req.body)))
router.post('/preview',route(req => service.previewBracket(req.admin.leagueId)))
router.post('/bracket',route(req => service.generateBracket(req.admin.leagueId,req.body.token)))
for (const method of ['put','delete']) router[method]('/matches/:id/result',route(req => {
  if (!integer(Number(req.params.id),1,2147483647)) throw fail(400,'Invalid playoff match ID')
  return service.recordResult(req.admin.leagueId,Number(req.params.id),req.body,method==='delete')
}))
module.exports = router
