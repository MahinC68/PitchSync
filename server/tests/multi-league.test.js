const request = require('supertest')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const app = require('../index')
const db = require('../db')
const { uid, createTestTeam, createTestPlayer, createTestMatch } = require('./helpers')

// These tests create their own accounts and leagues and remove only those records.
describe('Multi-league accounts and isolation', () => {
  let owner, stranger, first, second, foreign, token, foreignToken
  let a, b, c, d, foreignA, foreignB, player, foreignPlayer, match, foreignMatch
  const accounts = [], leagues = []
  const api = (method, url, league, auth = token) => {
    let req = request(app)[method](url).set('Authorization', `Bearer ${auth}`)
    if (league !== undefined) req = req.set('X-League-Id', String(league))
    return req
  }
  beforeAll(async () => {
    const register = async name => {
      const response = await request(app).post('/api/auth/register').send({ email: `${name}_${uid()}@example.com`, password: 'password123', leagueName: name })
      expect(response.status).toBe(201)
      accounts.push(response.body.admin.id); leagues.push(response.body.league.id)
      return response.body
    }
    owner = await register('First League'); first = owner.league; token = owner.token
    stranger = await register('Other Account'); foreign = stranger.league; foreignToken = stranger.token
    const created = await api('post', '/api/leagues').send({ name: 'Second League' })
    expect(created.status).toBe(201)
    second = created.body.data; leagues.push(second.id)
    a = await createTestTeam(first.id, 'Same name FC'); b = await createTestTeam(first.id, 'Opponent')
    c = await createTestTeam(second.id, 'Same name FC'); d = await createTestTeam(second.id, 'Other Opponent')
    foreignA = await createTestTeam(foreign.id); foreignB = await createTestTeam(foreign.id)
    player = await createTestPlayer(first.id, a.id)
    foreignPlayer = await createTestPlayer(foreign.id, foreignA.id)
    match = await createTestMatch(first.id, a.id, b.id, { status: 'completed', homeScore: 1, awayScore: 0 })
    foreignMatch = await createTestMatch(foreign.id, foreignA.id, foreignB.id, { status: 'completed', homeScore: 1, awayScore: 0 })
    await db.query('INSERT INTO goals (match_id, player_id, team_id) VALUES ($1, $2, $3)', [foreignMatch.id, foreignPlayer.id, foreignA.id])
  })
  afterAll(async () => {
    // Goals precede players/teams because they hold additional foreign keys.
    await db.query('DELETE FROM goals WHERE match_id IN (SELECT id FROM matches WHERE league_id = ANY($1::int[]))', [leagues])
    await db.query('DELETE FROM matches WHERE league_id = ANY($1::int[])', [leagues])
    await db.query('DELETE FROM players WHERE league_id = ANY($1::int[])', [leagues])
    await db.query('DELETE FROM teams WHERE league_id = ANY($1::int[])', [leagues])
    await db.query('DELETE FROM admins WHERE id = ANY($1::int[])', [accounts])
    await db.query('DELETE FROM leagues WHERE id = ANY($1::int[])', [leagues])
  })

  test('registration creates first membership and an account-only token', async () => {
    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({ adminId: owner.admin.id })
    expect(jwt.decode(token).leagueId).toBeUndefined()
    const list = await api('get', '/api/leagues')
    expect(list.body.data.map(league => league.id)).toEqual([first.id, second.id])
    expect(new Set(list.body.data.map(league => league.access_code)).size).toBe(2)
  })
  test('one token switches active league per request; teams stay independent', async () => {
    const firstResult = await api('get', '/api/teams', first.id)
    const secondResult = await api('get', '/api/teams', second.id)
    expect(firstResult.body.data.map(team => team.id)).toEqual(expect.arrayContaining([a.id, b.id]))
    expect(secondResult.body.data.map(team => team.id)).toEqual(expect.arrayContaining([c.id, d.id]))
    expect(secondResult.body.data.map(team => team.id)).not.toContain(a.id)
    expect((await api('get', `/api/leagues/${second.id}`)).status).toBe(200)
    expect((await api('get', '/api/auth/league', second.id)).body.data.id).toBe(second.id)
    expect((await api('get', '/api/auth/league', first.id)).body.data.id).toBe(first.id)
  })
  test('login still works for the same account and returns all owned leagues', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: owner.admin.email, password: 'password123' })
    expect(response.status).toBe(200)
    expect(response.body.leagues).toHaveLength(2)
    expect(response.body.league.id).toBe(first.id)
  })
  test('legacy JWT league claims still require real ownership', async () => {
    const oldToken = jwt.sign({ adminId: owner.admin.id, leagueId: first.id }, process.env.JWT_SECRET)
    expect((await api('get', '/api/teams', undefined, oldToken)).status).toBe(200)
    expect((await api('get', '/api/teams', second.id, oldToken)).status).toBe(200)
    const forgedClaim = jwt.sign({ adminId: owner.admin.id, leagueId: foreign.id }, process.env.JWT_SECRET)
    expect((await api('get', '/api/teams', undefined, forgedClaim)).status).toBe(403)
  })
  test('create and rename reject invalid input; renaming preserves access codes and other leagues', async () => {
    for (const name of ['', '   ', 'x'.repeat(101), {}, null]) {
      expect((await api('post', '/api/leagues').send({ name })).status).toBe(400)
      expect((await api('patch', `/api/leagues/${second.id}`).send({ name })).status).toBe(400)
    }
    const renamed = await api('patch', `/api/leagues/${second.id}`).send({ name: '  Renamed league  ' })
    expect(renamed.body.data).toMatchObject({ name: 'Renamed league', access_code: second.access_code })
    expect((await api('get', `/api/leagues/${first.id}`)).body.data.name).toBe(first.name)
    expect((await api('patch', `/api/leagues/${foreign.id}`).send({ name: 'Stolen' })).status).toBe(403)
  })
  test('foreign league selection is denied on every protected resource group', async () => {
    for (const url of ['/api/teams', `/api/players/team/${foreignA.id}`, `/api/goals/match/${foreignMatch.id}`, '/api/auth/league']) {
      expect((await api('get', url, foreign.id)).status).toBe(403)
    }
    expect((await api('post', '/api/fixtures', foreign.id).send({ home_team_id: foreignA.id, away_team_id: foreignB.id, date: '2026-11-05', time: '15:00' })).status).toBe(403)
    expect((await api('get', `/api/leagues/${foreign.id}`)).status).toBe(403)
    expect((await api('get', '/api/teams', 'not-an-id')).status).toBe(400)
  })
  test('resource IDs from another owned league cannot bleed into the active league', async () => {
    expect((await api('put', `/api/teams/${c.id}`, first.id).send({ name: 'Wrong' })).status).toBe(404)
    expect((await api('delete', `/api/players/${player.id}`, second.id)).status).toBe(404)
    expect((await api('post', '/api/players', first.id).send({ name: 'Wrong league', team_id: c.id })).status).toBe(403)
    expect((await api('post', '/api/fixtures', first.id).send({ home_team_id: a.id, away_team_id: c.id, date: '2026-11-05', time: '15:00' })).status).toBe(403)
    expect((await api('put', `/api/fixtures/${match.id}/result`, second.id).send({ home_score: 5, away_score: 4 })).status).toBe(404)
  })
  test('foreign match deletion cannot delete its goals', async () => {
    expect((await api('delete', `/api/fixtures/${foreignMatch.id}`, first.id)).status).toBe(404)
    const goals = await db.query('SELECT id FROM goals WHERE match_id = $1', [foreignMatch.id])
    expect(goals.rowCount).toBe(1)
    expect((await api('delete', `/api/goals/match/${foreignMatch.id}`, first.id)).status).toBe(403)
  })
  test('goals reject foreign scorers, foreign teams, and teams outside the match', async () => {
    expect((await api('post', '/api/goals', first.id).send({ match_id: match.id, player_id: foreignPlayer.id, team_id: foreignA.id })).status).toBe(403)
    expect((await api('post', '/api/goals', first.id).send({ match_id: match.id, player_id: player.id, team_id: b.id })).status).toBe(403)
    const unusedTeam = await createTestTeam(first.id)
    const unusedPlayer = await createTestPlayer(first.id, unusedTeam.id)
    expect((await api('post', '/api/goals', first.id).send({ match_id: match.id, player_id: unusedPlayer.id, team_id: unusedTeam.id })).status).toBe(403)
  })
  test('two leagues maintain separate results, standings and scorers', async () => {
    const fixture = await api('post', '/api/fixtures', second.id).send({ home_team_id: c.id, away_team_id: d.id, date: '2026-11-10', time: '18:30' })
    expect(fixture.status).toBe(201)
    expect((await api('put', `/api/fixtures/${fixture.body.data.id}/result`, second.id).send({ home_score: 3, away_score: 1 })).status).toBe(200)
    const scorer = await api('post', '/api/players', second.id).send({ name: 'Second league scorer', team_id: c.id })
    expect((await api('post', '/api/goals', second.id).send({ match_id: fixture.body.data.id, player_id: scorer.body.data.id, team_id: c.id })).status).toBe(201)
    const tableA = await request(app).get(`/api/standings/${first.id}`)
    const tableB = await request(app).get(`/api/standings/${second.id}`)
    expect(tableA.body.data.find(team => team.teamId === a.id).gf).toBe(1)
    expect(tableB.body.data.find(team => team.teamId === c.id).gf).toBe(3)
    expect(tableA.body.data.map(team => team.teamId)).not.toContain(c.id)
    const scorersA = await request(app).get(`/api/players/${first.id}/top-scorers`)
    expect(scorersA.body.data.map(player => player.playerId)).not.toContain(scorer.body.data.id)
  })
  test('player access-code login and read-only access remain unchanged', async () => {
    const response = await request(app).post('/api/auth/verify-code').send({ accessCode: second.access_code.toLowerCase() })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ leagueId: second.id, leagueName: 'Renamed league' })
    expect((await request(app).get(`/api/fixtures/${second.id}`)).status).toBe(200)
    expect((await request(app).post('/api/leagues').send({ name: 'No account' })).status).toBe(401)
    expect((await request(app).post('/api/teams').send({ name: 'Not allowed' })).status).toBe(401)
  })
  test('an absent account or revoked membership cannot keep using an old token', async () => {
    const nonexistent = jwt.sign({ adminId: 2147483647 }, process.env.JWT_SECRET)
    expect((await api('get', '/api/leagues', undefined, nonexistent)).status).toBe(401)
    await db.query('DELETE FROM admin_leagues WHERE admin_id = $1 AND league_id = $2', [stranger.admin.id, foreign.id])
    expect((await api('get', '/api/teams', foreign.id, foreignToken)).status).toBe(403)
  })
})

test('access-code collisions retry without aborting league creation', async () => {
  const crypto = require('crypto')
  const { createLeague } = require('../services/leagues')
  const client = await db.pool.connect()
  let random
  try {
    await client.query('BEGIN')
    await client.query("INSERT INTO leagues (name, access_code) VALUES ('Existing code', 'C0FFEE') ON CONFLICT (access_code) DO NOTHING")
    random = jest.spyOn(crypto, 'randomBytes').mockReturnValueOnce(Buffer.from('c0ffee', 'hex'))
    const league = await createLeague(client, 'Unique after collision')
    expect(league.access_code).not.toBe('C0FFEE')
    expect(league.access_code).toMatch(/^[A-F0-9]{6}$/)
    expect((await client.query("SELECT name FROM leagues WHERE access_code = 'C0FFEE'")).rowCount).toBe(1)
    expect(random.mock.calls.length).toBeGreaterThanOrEqual(2)
  } finally { random?.mockRestore(); await client.query('ROLLBACK'); client.release() }
})

test('migration backfills legacy ownership, is repeatable, and preserves accounts and data', async () => {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const schema = `migration_${uid()}`
    await client.query(`CREATE SCHEMA ${schema}`)
    // Resolve all migration objects in a transaction-local schema, not the app schema.
    await client.query(`SET LOCAL search_path TO ${schema}`)
    await client.query(`CREATE TABLE leagues (id SERIAL PRIMARY KEY, name TEXT, access_code TEXT UNIQUE);
      CREATE TABLE admins (id SERIAL PRIMARY KEY, email TEXT, league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE);
      CREATE TABLE teams (id SERIAL PRIMARY KEY, league_id INTEGER REFERENCES leagues(id), name TEXT);
      INSERT INTO leagues (name, access_code) VALUES ('Original', 'LEGACY1'), ('Another', 'LEGACY2');
      INSERT INTO admins (email, league_id) VALUES ('existing@example.com', 1), ('legacy-shared@example.com', 1);
      INSERT INTO teams (league_id, name) VALUES (1, 'Keep this team');`)
    const sql = fs.readFileSync(path.join(__dirname, '../db/migrations/001_multi_league_accounts.sql'), 'utf8')
    await client.query(sql); await client.query(sql)
    expect((await client.query('SELECT admin_id, league_id FROM admin_leagues ORDER BY admin_id')).rows).toEqual([{ admin_id: 1, league_id: 1 }, { admin_id: 2, league_id: 1 }])
    expect((await client.query('SELECT name FROM teams')).rows[0].name).toBe('Keep this team')
    await client.query('INSERT INTO admin_leagues (admin_id, league_id) VALUES (1, 2)')
    await client.query('DELETE FROM teams WHERE league_id = 1')
    await client.query('DELETE FROM leagues WHERE id = 1')
    expect((await client.query('SELECT email, league_id FROM admins ORDER BY id')).rows).toEqual([{ email: 'existing@example.com', league_id: null }, { email: 'legacy-shared@example.com', league_id: null }])
    expect((await client.query('SELECT league_id FROM admin_leagues')).rows).toEqual([{ league_id: 2 }])
  } finally { await client.query('ROLLBACK'); client.release() }
})
