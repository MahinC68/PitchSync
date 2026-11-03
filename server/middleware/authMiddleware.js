const jwt = require('jsonwebtoken')
const db = require('../db')

async function account(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'No token provided' })
  let payload
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] })
    if (!Number.isSafeInteger(payload.adminId) || payload.adminId <= 0) throw new Error('Invalid account')
  } catch { return res.status(401).json({ success: false, error: 'Invalid or expired token' }) }
  try {
    const { rows: [admin] } = await db.query('SELECT id, email FROM admins WHERE id = $1', [payload.adminId])
    if (!admin) return res.status(401).json({ success: false, error: 'Account no longer exists' })
    req.admin = { adminId: admin.id, email: admin.email }
    req.legacyLeagueId = payload.leagueId
    next()
  } catch (error) { next(error) }
}

async function league(req, res, next) {
  // Old tokens remain usable, but their league claim is always checked against ownership.
  const requested = req.get('X-League-Id') ?? req.legacyLeagueId
  if (requested !== undefined && (!/^\d+$/.test(String(requested)) || !Number.isSafeInteger(Number(requested)) || Number(requested) <= 0)) {
    return res.status(400).json({ success: false, error: 'Invalid league ID' })
  }
  try {
    const { rows: [owned] } = await db.query(
      `SELECT l.id, l.name, l.access_code FROM leagues l
       JOIN admin_leagues al ON al.league_id = l.id
       WHERE al.admin_id = $1 ${requested === undefined ? '' : 'AND l.id = $2'}
       ORDER BY l.created_at, l.id LIMIT 1`,
      requested === undefined ? [req.admin.adminId] : [req.admin.adminId, Number(requested)]
    )
    if (!owned) return res.status(403).json({ success: false, error: 'You do not own this league' })
    req.admin.leagueId = owned.id
    req.league = owned
    next()
  } catch (error) { next(error) }
}

function authMiddleware(req, res, next) { account(req, res, error => error ? next(error) : league(req, res, next)) }
authMiddleware.account = account
module.exports = authMiddleware
