require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const app  = express()
const PORT = process.env.PORT || 3000

const ALLOWED_ORIGINS = new Set([
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5174',
])

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.has(origin)),
  credentials: true,
}))
app.use(express.json())

const authRoutes      = require('./routes/auth')
const standingsRoutes = require('./routes/standings')
const fixturesRoutes  = require('./routes/fixtures')
const playersRoutes   = require('./routes/players')
const teamsRoutes     = require('./routes/teams')
const goalsRoutes     = require('./routes/goals')

app.use('/api/team-logos', require('./routes/logos'))
app.use('/api/league-logos', require('./routes/logos'))
app.use('/api/branding', require('./routes/branding'))
app.use('/api/announcements', require('./routes/announcements'))
app.use('/api/rules', require('./routes/rules'))
app.use('/api/playoffs', require('./routes/playoffs'))
app.use('/api/leagues', require('./routes/leagues'))

app.use('/api/auth',      authRoutes)
app.use('/api/standings', standingsRoutes)
app.use('/api/fixtures',  fixturesRoutes)
app.use('/api/players',   playersRoutes)
app.use('/api/teams',     teamsRoutes)
app.use('/api/goals',     goalsRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Always return JSON errors, including rejected database operations.
app.use((error, _req, res, _next) => {
  console.error(error.message)
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : error.status === 503 ? 503 : 500
  res.status(status).json({ success: false, error: status === 500 ? 'Server error' : error.message,
    ...(error.code === 'DOWNSTREAM_RESULTS' || error.code === 'STALE_BRACKET' ? { code:error.code, details:error.details } : {}) })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`PitchSync API listening on port ${PORT}`)
  })
}

module.exports = app
