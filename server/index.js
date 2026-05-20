require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const app  = express()
const PORT = process.env.PORT || 3001

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

app.use('/api/auth',      authRoutes)
app.use('/api/standings', standingsRoutes)
app.use('/api/fixtures',  fixturesRoutes)
app.use('/api/players',   playersRoutes)
app.use('/api/teams',     teamsRoutes)
app.use('/api/goals',     goalsRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`PitchSync API listening on port ${PORT}`)
  })
}

module.exports = app
