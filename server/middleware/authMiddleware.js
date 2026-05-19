const jwt = require('jsonwebtoken')

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    req.admin = payload   // { adminId, leagueId }
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

module.exports = authMiddleware
