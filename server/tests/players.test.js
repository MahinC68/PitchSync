const request = require('supertest')
const app     = require('../index')
const db      = require('../db')
const {
  createTestLeague, createTestAdmin, generateToken,
  createTestTeam, createTestPlayer, createTestMatch, cleanupLeague,
} = require('./helpers')

describe('Players routes', () => {
  let league, admin, token, team, opponent, match

  beforeAll(async () => {
    league   = await createTestLeague()
    admin    = await createTestAdmin(league.id)
    token    = generateToken(admin.id, league.id)
    team     = await createTestTeam(league.id, 'Scorers FC')
    opponent = await createTestTeam(league.id, 'Opponents FC')
    match    = await createTestMatch(league.id, team.id, opponent.id, {
      status: 'completed', homeScore: 3, awayScore: 0, date: '2025-01-01',
    })
  })

  afterAll(async () => {
    await cleanupLeague(league.id)
  })

  test('GET /api/players/:league_id/top-scorers — ranked by goals descending', async () => {
    const p1 = await createTestPlayer(league.id, team.id, 'Top Scorer')
    const p2 = await createTestPlayer(league.id, team.id, 'Second Scorer')

    // p1 scores 2, p2 scores 1
    await db.query(
      'INSERT INTO goals (match_id, player_id, team_id) VALUES ($1, $2, $3)',
      [match.id, p1.id, team.id]
    )
    await db.query(
      'INSERT INTO goals (match_id, player_id, team_id) VALUES ($1, $2, $3)',
      [match.id, p1.id, team.id]
    )
    await db.query(
      'INSERT INTO goals (match_id, player_id, team_id) VALUES ($1, $2, $3)',
      [match.id, p2.id, team.id]
    )

    const res = await request(app).get(`/api/players/${league.id}/top-scorers`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)

    const top    = res.body.data.find(s => s.playerId === p1.id)
    const second = res.body.data.find(s => s.playerId === p2.id)

    expect(top.goals).toBe(2)
    expect(second.goals).toBe(1)
    expect(top.rank).toBeLessThan(second.rank)
  })

  test('POST /api/players — creates player with valid auth', async () => {
    const res = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Player', team_id: team.id })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('New Player')
    expect(res.body.data.team_id).toBe(team.id)
    expect(res.body.data.league_id).toBe(league.id)
  })

  test('DELETE /api/players/:id — removes player', async () => {
    const player = await createTestPlayer(league.id, team.id, 'To Delete')

    const res = await request(app)
      .delete(`/api/players/${player.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const { rows } = await db.query('SELECT id FROM players WHERE id = $1', [player.id])
    expect(rows.length).toBe(0)
  })

  test('POST /api/goals — creates goal record', async () => {
    const player = await createTestPlayer(league.id, team.id, 'Goalscorer')

    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({ match_id: match.id, player_id: player.id, team_id: team.id })

    expect(res.status).toBe(201)
    expect(res.body.data.player_id).toBe(player.id)
    expect(res.body.data.match_id).toBe(match.id)
    expect(res.body.data.team_id).toBe(team.id)
  })

  test('GET /api/players/team/:team_id — returns players for that team', async () => {
    const p1  = await createTestPlayer(league.id, team.id, 'Alpha Player')
    const p2  = await createTestPlayer(league.id, team.id, 'Beta Player')
    const res = await request(app)
      .get(`/api/players/team/${team.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const ids = res.body.data.map(p => p.id)
    expect(ids).toContain(p1.id)
    expect(ids).toContain(p2.id)
  })

  test('POST /api/players — returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({ name: 'Unauthed Player', team_id: team.id })

    expect(res.status).toBe(401)
  })

  test('DELETE /api/players/:id — returns 401 without auth', async () => {
    const player = await createTestPlayer(league.id, team.id, 'Unauthed Delete')
    const res    = await request(app).delete(`/api/players/${player.id}`)

    expect(res.status).toBe(401)
  })

  test('DELETE /api/players/:id — returns 404 for non-existent player', async () => {
    const res = await request(app)
      .delete('/api/players/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  test('GET /api/goals/match/:match_id — returns goals for match', async () => {
    const player = await createTestPlayer(league.id, team.id, 'Goal Getter')
    await db.query(
      'INSERT INTO goals (match_id, player_id, team_id) VALUES ($1, $2, $3)',
      [match.id, player.id, team.id]
    )

    const res = await request(app)
      .get(`/api/goals/match/${match.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.some(g => g.player_id === player.id)).toBe(true)
    expect(res.body.data[0]).toHaveProperty('player_name')
  })

  test('POST /api/goals — returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({ match_id: match.id })

    expect(res.status).toBe(400)
  })

  test('DELETE /api/goals/match/:match_id — removes all goals for match', async () => {
    const extraMatch = await createTestMatch(league.id, team.id, opponent.id, {
      status: 'completed', homeScore: 1, awayScore: 0, date: '2025-03-01',
    })
    const player = await createTestPlayer(league.id, team.id, 'Clean Sweep')
    await db.query(
      'INSERT INTO goals (match_id, player_id, team_id) VALUES ($1, $2, $3)',
      [extraMatch.id, player.id, team.id]
    )

    const res = await request(app)
      .delete(`/api/goals/match/${extraMatch.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const { rows } = await db.query('SELECT id FROM goals WHERE match_id = $1', [extraMatch.id])
    expect(rows.length).toBe(0)
  })

  test('GET /api/goals/match/:match_id — returns 403 for match in another league', async () => {
    const otherLeague = await createTestLeague()
    const otherAdmin  = await createTestAdmin(otherLeague.id)
    const otherToken  = generateToken(otherAdmin.id, otherLeague.id)

    try {
      const res = await request(app)
        .get(`/api/goals/match/${match.id}`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(403)
    } finally {
      await cleanupLeague(otherLeague.id)
    }
  })

  test('DELETE /api/goals/match/:match_id — returns 403 for match in another league', async () => {
    const otherLeague = await createTestLeague()
    const otherAdmin  = await createTestAdmin(otherLeague.id)
    const otherToken  = generateToken(otherAdmin.id, otherLeague.id)

    try {
      const res = await request(app)
        .delete(`/api/goals/match/${match.id}`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(403)
    } finally {
      await cleanupLeague(otherLeague.id)
    }
  })
})
