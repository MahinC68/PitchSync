const request = require('supertest')
const app     = require('../index')
const {
  createTestLeague, createTestAdmin, generateToken,
  createTestTeam, createTestMatch, cleanupLeague, uid,
} = require('./helpers')

describe('Fixtures routes', () => {
  let league, admin, token, teamA, teamB, scheduledMatch, completedMatch

  beforeAll(async () => {
    league         = await createTestLeague()
    admin          = await createTestAdmin(league.id)
    token          = generateToken(admin.id, league.id)
    teamA          = await createTestTeam(league.id, 'Home FC')
    teamB          = await createTestTeam(league.id, 'Away FC')
    scheduledMatch = await createTestMatch(league.id, teamA.id, teamB.id, {
      status: 'scheduled', date: '2025-12-01',
    })
    completedMatch = await createTestMatch(league.id, teamA.id, teamB.id, {
      status: 'completed', homeScore: 2, awayScore: 1, date: '2025-01-01',
    })
  })

  afterAll(async () => {
    await cleanupLeague(league.id)
  })

  test('GET /api/fixtures/:league_id — returns upcoming and past arrays', async () => {
    const res = await request(app).get(`/api/fixtures/${league.id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.upcoming)).toBe(true)
    expect(Array.isArray(res.body.data.past)).toBe(true)
    expect(res.body.data.upcoming.some(f => f.id === scheduledMatch.id)).toBe(true)
    expect(res.body.data.past.some(f => f.id === completedMatch.id)).toBe(true)
  })

  test('POST /api/fixtures — creates fixture with valid auth', async () => {
    const res = await request(app)
      .post('/api/fixtures')
      .set('Authorization', `Bearer ${token}`)
      .send({ home_team_id: teamA.id, away_team_id: teamB.id, date: '2025-06-01', time: '15:00' })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('scheduled')
    expect(res.body.data.league_id).toBe(league.id)
  })

  test('POST /api/fixtures — returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/fixtures')
      .send({ home_team_id: teamA.id, away_team_id: teamB.id, date: '2025-06-01', time: '15:00' })

    expect(res.status).toBe(401)
  })

  test('PUT /api/fixtures/:id/result — updates scores and marks completed', async () => {
    const res = await request(app)
      .put(`/api/fixtures/${scheduledMatch.id}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ home_score: 3, away_score: 2 })

    expect(res.status).toBe(200)
    expect(res.body.data.home_score).toBe(3)
    expect(res.body.data.away_score).toBe(2)
    expect(res.body.data.status).toBe('completed')
  })

  test('PUT /api/fixtures/:id/result — returns 401 without auth', async () => {
    const res = await request(app)
      .put(`/api/fixtures/${completedMatch.id}/result`)
      .send({ home_score: 1, away_score: 0 })

    expect(res.status).toBe(401)
  })

  test('POST /api/fixtures — returns 400 when same team on both sides', async () => {
    const res = await request(app)
      .post('/api/fixtures')
      .set('Authorization', `Bearer ${token}`)
      .send({ home_team_id: teamA.id, away_team_id: teamA.id, date: '2025-07-01', time: '15:00' })

    expect(res.status).toBe(400)
  })

  test('DELETE /api/fixtures/:id — removes fixture and cascades goals', async () => {
    const toDelete = await createTestMatch(league.id, teamA.id, teamB.id, {
      status: 'scheduled', date: '2025-11-01',
    })

    const res = await request(app)
      .delete(`/api/fixtures/${toDelete.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('DELETE /api/fixtures/:id — returns 401 without auth', async () => {
    const res = await request(app).delete(`/api/fixtures/${completedMatch.id}`)
    expect(res.status).toBe(401)
  })

  test('POST /api/fixtures — returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/fixtures')
      .set('Authorization', `Bearer ${token}`)
      .send({ home_team_id: teamA.id })

    expect(res.status).toBe(400)
  })

  test('PUT /api/fixtures/:id/result — returns 400 when scores are missing', async () => {
    const res = await request(app)
      .put(`/api/fixtures/${completedMatch.id}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  test('PUT /api/fixtures/:id/result — returns 404 for non-existent fixture', async () => {
    const res = await request(app)
      .put('/api/fixtures/999999/result')
      .set('Authorization', `Bearer ${token}`)
      .send({ home_score: 1, away_score: 0 })

    expect(res.status).toBe(404)
  })
})

describe('Teams routes', () => {
  let league, admin, token, existingTeam

  beforeAll(async () => {
    league       = await createTestLeague()
    admin        = await createTestAdmin(league.id)
    token        = generateToken(admin.id, league.id)
    existingTeam = await createTestTeam(league.id, 'Existing FC')
  })

  afterAll(async () => {
    await cleanupLeague(league.id)
  })

  test('GET /api/teams — returns teams scoped to admin league', async () => {
    const res = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.some(t => t.id === existingTeam.id)).toBe(true)
    expect(res.body.data.every(t => t.id && t.name)).toBe(true)
  })

  test('GET /api/teams — returns 401 without auth', async () => {
    const res = await request(app).get('/api/teams')
    expect(res.status).toBe(401)
  })

  test('POST /api/teams — creates team with valid auth', async () => {
    const name = `NewTeam_${uid()}`
    const res  = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe(name)
    expect(res.body.data.league_id).toBe(league.id)
  })

  test('POST /api/teams — returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  test('POST /api/teams — returns 409 on duplicate name', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: existingTeam.name })

    expect(res.status).toBe(409)
  })

  test('PUT /api/teams/:id — renames team', async () => {
    const newName = `Renamed_${uid()}`
    const res     = await request(app)
      .put(`/api/teams/${existingTeam.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: newName })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe(newName)
    expect(res.body.data.id).toBe(existingTeam.id)
  })

  test('PUT /api/teams/:id — returns 400 when name is missing', async () => {
    const res = await request(app)
      .put(`/api/teams/${existingTeam.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  test('PUT /api/teams/:id — returns 404 for non-existent team', async () => {
    const res = await request(app)
      .put('/api/teams/999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost FC' })

    expect(res.status).toBe(404)
  })

  test('PUT /api/teams/:id — returns 409 when renaming to an existing team name', async () => {
    const teamX = await createTestTeam(league.id, `TeamX_${uid()}`)
    const teamY = await createTestTeam(league.id, `TeamY_${uid()}`)

    const res = await request(app)
      .put(`/api/teams/${teamX.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: teamY.name })

    expect(res.status).toBe(409)
  })

  test('DELETE /api/teams/:id — removes team', async () => {
    const team = await createTestTeam(league.id, `ToDelete_${uid()}`)
    const res  = await request(app)
      .delete(`/api/teams/${team.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('DELETE /api/teams/:id — returns 404 for non-existent team', async () => {
    const res = await request(app)
      .delete('/api/teams/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
