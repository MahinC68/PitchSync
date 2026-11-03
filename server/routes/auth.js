const express        = require('express')
const bcrypt         = require('bcryptjs')
const jwt            = require('jsonwebtoken')
const crypto         = require('crypto')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const { createLeague, validLeagueName, ownedLeagues } = require('../services/leagues')
const router = express.Router()

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// ── GET /api/auth/league (admin only) ────────────────────────────────────────
router.get('/league', authMiddleware, (req, res) => res.json({ success: true, data: req.league }))

router.post('/register', async (req, res, next) => {
  const { email, password, leagueName } = req.body
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password || !validLeagueName(leagueName)) {
    return res.status(400).json({ error: 'Email, password and a league name (1–100 characters) are required' })
  }
  const normalizedEmail = email.trim().toLowerCase()
  let client
  try {
    const hash = await bcrypt.hash(password, 10)
    client = await db.pool.connect()
    await client.query('BEGIN')
    const { rows: [admin] } = await client.query(
      'INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id, email', [normalizedEmail, hash])
    const league = await createLeague(client, leagueName)
    await client.query('INSERT INTO admin_leagues (admin_id, league_id) VALUES ($1, $2)', [admin.id, league.id])
    await client.query('COMMIT')
    return res.status(201).json({ token: signToken({ adminId: admin.id }), admin,
      league: { id: league.id, name: league.name, accessCode: league.access_code }, leagues: [league] })
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' })
    next(error)
  } finally { client?.release() }
})

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }
  try {
    const { rows: [admin] } = await db.query('SELECT id, email, password_hash FROM admins WHERE email = $1', [email.trim().toLowerCase()])
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json({ error: 'Invalid email or password' })
    const leagues = await ownedLeagues(db, admin.id)
    const league = leagues[0]
    return res.json({ token: signToken({ adminId: admin.id }), admin: { id: admin.id, email: admin.email }, leagues,
      league: league ? { id: league.id, name: league.name, accessCode: league.access_code } : null })
  } catch (error) { next(error) }
})

// ── POST /api/auth/verify-code ────────────────────────────────────────────────
router.post('/verify-code', async (req, res) => {
  const { accessCode } = req.body

  if (!accessCode) {
    return res.status(400).json({ error: 'accessCode is required' })
  }

  try {
    const { rows } = await db.query(
      'SELECT id, name FROM leagues WHERE access_code = $1',
      [accessCode.trim().toUpperCase()]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid access code' })
    }

    return res.json({ leagueId: rows[0].id, leagueName: rows[0].name })
  } catch (err) {
    console.error('verify-code:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'email is required' })
  }

  try {
    const { rows } = await db.query(
      'SELECT id FROM admins WHERE email = $1',
      [email.trim().toLowerCase()]
    )

    if (rows.length > 0) {
      const resetToken = crypto.randomBytes(32).toString('hex')
      const expiry     = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await db.query(
        `UPDATE admins
         SET reset_token = $1, reset_token_expiry = $2
         WHERE id = $3`,
        [resetToken, expiry, rows[0].id]
      )

      // TODO: send email via Resend containing resetToken
    }

    // Always return success to prevent email enumeration
    return res.json({ message: 'If that email exists, a reset link has been sent' })
  } catch (err) {
    console.error('forgot-password:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required' })
  }

  try {
    const { rows } = await db.query(
      `SELECT id FROM admins
       WHERE  reset_token = $1
       AND    reset_token_expiry > NOW()`,
      [token]
    )

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await db.query(
      `UPDATE admins
       SET    password_hash = $1,
              reset_token = NULL,
              reset_token_expiry = NULL
       WHERE  id = $2`,
      [passwordHash, rows[0].id]
    )

    return res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('reset-password:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
