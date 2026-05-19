require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// ── Routes (uncomment as each file is implemented) ───────────────────────────
// const authRoutes      = require('./routes/auth')
// const standingsRoutes = require('./routes/standings')
// const fixturesRoutes  = require('./routes/fixtures')
// const playersRoutes   = require('./routes/players')
// const teamsRoutes     = require('./routes/teams')

// app.use('/api/auth',      authRoutes)
// app.use('/api/standings', standingsRoutes)
// app.use('/api/fixtures',  fixturesRoutes)
// app.use('/api/players',   playersRoutes)
// app.use('/api/teams',     teamsRoutes)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`PitchSync API listening on port ${PORT}`)
})

module.exports = app
