require('dotenv').config()
const db     = require('../db')
const jwt    = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

function uid() {
  return crypto.randomBytes(4).toString('hex')
}

async function createTestLeague(name) {
  const n    = name || `TestLeague_${uid()}`
  const code = crypto.randomBytes(3).toString('hex').toUpperCase()
  const { rows: [league] } = await db.query(
    `INSERT INTO leagues (name, access_code) VALUES ($1, $2) RETURNING *`,
    [n, code]
  )
  return league
}

async function createTestAdmin(leagueId, email) {
  const e            = email || `test_${uid()}@example.com`
  const passwordHash = await bcrypt.hash('password123', 10)
  const { rows: [admin] } = await db.query(
    `INSERT INTO admins (email, password_hash, league_id) VALUES ($1, $2, $3) RETURNING id, email, league_id`,
    [e, passwordHash, leagueId]
  )
  return { ...admin, password: 'password123' }
}

function generateToken(adminId, leagueId) {
  return jwt.sign({ adminId, leagueId }, process.env.JWT_SECRET, { expiresIn: '1h' })
}

async function createTestTeam(leagueId, name) {
  const n = name || `Team_${uid()}`
  const { rows: [team] } = await db.query(
    `INSERT INTO teams (name, league_id) VALUES ($1, $2) RETURNING *`,
    [n, leagueId]
  )
  return team
}

async function createTestPlayer(leagueId, teamId, name) {
  const n = name || `Player_${uid()}`
  const { rows: [player] } = await db.query(
    `INSERT INTO players (name, team_id, league_id) VALUES ($1, $2, $3) RETURNING *`,
    [n, teamId, leagueId]
  )
  return player
}

async function createTestMatch(leagueId, homeTeamId, awayTeamId, opts = {}) {
  const date   = opts.date   || '2025-01-01'
  const time   = opts.time   || '15:00:00'
  const status = opts.status || 'scheduled'

  if (opts.homeScore != null && opts.awayScore != null) {
    const { rows: [match] } = await db.query(
      `INSERT INTO matches
         (league_id, home_team_id, away_team_id, date, time, status, home_score, away_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [leagueId, homeTeamId, awayTeamId, date, time, status, opts.homeScore, opts.awayScore]
    )
    return match
  }

  const { rows: [match] } = await db.query(
    `INSERT INTO matches (league_id, home_team_id, away_team_id, date, time, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [leagueId, homeTeamId, awayTeamId, date, time, status]
  )
  return match
}

async function cleanupLeague(leagueId) {
  // Delete in FK dependency order: goals → matches/players → teams → admins → league
  await db.query(
    'DELETE FROM goals WHERE match_id IN (SELECT id FROM matches WHERE league_id = $1)',
    [leagueId]
  )
  await db.query('DELETE FROM matches WHERE league_id = $1', [leagueId])
  await db.query('DELETE FROM players WHERE league_id = $1', [leagueId])
  await db.query('DELETE FROM teams WHERE league_id = $1', [leagueId])
  await db.query('DELETE FROM admins WHERE league_id = $1', [leagueId])
  await db.query('DELETE FROM leagues WHERE id = $1', [leagueId])
}

module.exports = {
  uid,
  createTestLeague,
  createTestAdmin,
  generateToken,
  createTestTeam,
  createTestPlayer,
  createTestMatch,
  cleanupLeague,
}
