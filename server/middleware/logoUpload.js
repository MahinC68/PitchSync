const multer = require('multer')
const { storageRoot } = require('../services/logos')

// Ownership middleware must run before buffering any upload.
module.exports = function logoUpload(label = 'Team') {
  const upload = multer({ storage:multer.memoryStorage(), limits:{ fileSize:2*1024*1024, files:1, fields:0, parts:2 } }).single('logo')
  return (req,res,next) => {
    try { storageRoot(label) } catch (error) { return next(error) }
    upload(req,res,error => {
      if (error) return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code==='LIMIT_FILE_SIZE'?`${label} logos must be 2 MB or smaller`:'Upload exactly one logo file, with no additional form fields'})
      next()
    })
  }
}
