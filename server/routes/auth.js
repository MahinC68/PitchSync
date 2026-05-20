const express        = require('express')
const bcrypt         = require('bcryptjs')
const jwt            = require('jsonwebtoken')
const crypto         = require('crypto')
const db             = require('../db')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

function generateAccessCode() {
  // 3 random bytes → 6 uppercase hex chars
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// ── GET /api/auth/league (admin only) ────────────────────────────────────────
router.get('/league', authMiddleware, async (req, res) => {
  try {
    const { rows: [league] } = await db.query(
      'SELECT id, name, access_code FROM leagues WHERE id = $1',
      [req.admin.leagueId]
    )
    return res.json({ success: true, data: league })
  } catch (err) {
    console.error('auth/league GET:', err.message)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, leagueName } = req.body

  if (!email || !password || !leagueName) {
    return res.status(400).json({ error: 'email, password and leagueName are required' })
  }

  const normalizedEmail = email.trim().toLowerCase()

  const client = await db.pool.connect()
  try {
    const existing = await client.query(
      'SELECT id FROM admins WHERE email = $1',
      [normalizedEmail]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }

    const accessCode   = generateAccessCode()
    const passwordHash = await bcrypt.hash(password, 10)

    await client.query('BEGIN')

    const { rows: [league] } = await client.query(
      `INSERT INTO leagues (name, access_code)
       VALUES ($1, $2)
       RETURNING id, name, access_code`,
      [leagueName.trim(), accessCode]
    )

    const { rows: [admin] } = await client.query(
      `INSERT INTO admins (email, password_hash, league_id)
       VALUES ($1, $2, $3)
       RETURNING id, email`,
      [normalizedEmail, passwordHash, league.id]
    )

    await client.query('COMMIT')

    const token = signToken({ adminId: admin.id, leagueId: league.id })

    return res.status(201).json({
      token,
      admin:  { id: admin.id, email: admin.email },
      league: { id: league.id, name: league.name, accessCode: league.access_code },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('register:', err.message)
    return res.status(500).json({ error: 'Server error' })
  } finally {
    client.release()
  }
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  try {
    const { rows } = await db.query(
      `SELECT a.id, a.email, a.password_hash, a.league_id,
              l.name AS league_name, l.access_code
       FROM   admins  a
       JOIN   leagues l ON l.id = a.league_id
       WHERE  a.email = $1`,
      [email.trim().toLowerCase()]
    )

    // Same message for unknown email and wrong password to prevent enumeration
    if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const admin = rows[0]
    const token = signToken({ adminId: admin.id, leagueId: admin.league_id })

    return res.json({
      token,
      admin:  { id: admin.id, email: admin.email },
      league: { id: admin.league_id, name: admin.league_name, accessCode: admin.access_code },
    })
  } catch (err) {
    console.error('login:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
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
