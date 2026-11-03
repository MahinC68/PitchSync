const express = require('express')
const path = require('path')
const { storageRoot, KEY } = require('../services/logos')
const router = express.Router()
router.get('/:key', (req,res,next) => {
  if (!KEY.test(req.params.key)) return res.status(404).json({error:'Logo not found'})
  try {
    res.set({ 'Content-Type':'image/webp', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'none'", 'Cache-Control':'public, max-age=31536000, immutable' })
    res.sendFile(path.join(storageRoot(),req.params.key),error => { if (error) { if (!res.headersSent) res.removeHeader('Cache-Control'); if (error.code === 'ENOENT' || error.status === 404) res.status(404).end(); else next(error) } })
  } catch (error) { next(error) }
})
module.exports = router
