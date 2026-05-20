const request = require('supertest')
const app     = require('../index')
const db      = require('../db')
const { uid, createTestLeague, createTestAdmin, generateToken, cleanupLeague } = require('./helpers')

describe('Auth routes', () => {
  const cleanup = []

  afterAll(async () => {
    for (const id of cleanup) {
      await db.query('DELETE FROM leagues WHERE id = $1', [id]).catch(() => {})
    }
  })

  test('POST /api/auth/register — returns token, admin and league on success', async () => {
    const email      = `reg_${uid()}@example.com`
    const leagueName = `League_${uid()}`

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'pass1234', leagueName })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.admin.email).toBe(email)
    expect(res.body.league.accessCode).toMatch(/^[A-F0-9]{6}$/)
    cleanup.push(res.body.league.id)
  })

  test('POST /api/auth/register — duplicate email returns 409', async () => {
    const email = `dup_${uid()}@example.com`

    const r1 = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'pass1234', leagueName: `L1_${uid()}` })
    cleanup.push(r1.body.league.id)

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'pass1234', leagueName: `L2_${uid()}` })

    expect(res.status).toBe(409)
  })

  test('POST /api/auth/login — returns token on success', async () => {
    const league = await createTestLeague()
    cleanup.push(league.id)
    const admin = await createTestAdmin(league.id)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.admin.email).toBe(admin.email)
    expect(res.body.league.id).toBe(league.id)
  })

  test('POST /api/auth/login — wrong password returns 401', async () => {
    const league = await createTestLeague()
    cleanup.push(league.id)
    const admin = await createTestAdmin(league.id)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'wrongpassword' })

    expect(res.status).toBe(401)
  })

  test('POST /api/auth/login — non-existent email returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `nobody_${uid()}@example.com`, password: 'pass1234' })

    expect(res.status).toBe(401)
  })

  test('POST /api/auth/verify-code — returns leagueId and leagueName on success', async () => {
    const league = await createTestLeague()
    cleanup.push(league.id)

    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ accessCode: league.access_code })

    expect(res.status).toBe(200)
    expect(res.body.leagueId).toBe(league.id)
    expect(res.body.leagueName).toBe(league.name)
  })

  test('POST /api/auth/verify-code — invalid code returns 404', async () => {
    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ accessCode: '000000' })

    expect(res.status).toBe(404)
  })

  test('POST /api/auth/register — returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'only@example.com' })

    expect(res.status).toBe(400)
  })

  test('POST /api/auth/login — returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'only@example.com' })

    expect(res.status).toBe(400)
  })

  test('POST /api/auth/verify-code — returns 400 when accessCode is missing', async () => {
    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({})

    expect(res.status).toBe(400)
  })

  test('GET /api/auth/league — returns league info with valid token', async () => {
    const league = await createTestLeague()
    cleanup.push(league.id)
    const admin = await createTestAdmin(league.id)
    const token = generateToken(admin.id, league.id)

    const res = await request(app)
      .get('/api/auth/league')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe(league.id)
    expect(res.body.data.name).toBe(league.name)
    expect(res.body.data.access_code).toBe(league.access_code)
  })

  test('GET /api/auth/league — returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/league')
    expect(res.status).toBe(401)
  })

  test('POST /api/auth/forgot-password — always returns 200', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: `unknown_${uid()}@example.com` })

    expect(res.status).toBe(200)
    expect(res.body.message).toBeDefined()
  })

  test('POST /api/auth/forgot-password — returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({})

    expect(res.status).toBe(400)
  })

  test('POST /api/auth/reset-password — returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc' })

    expect(res.status).toBe(400)
  })

  test('POST /api/auth/reset-password — returns 400 for invalid or expired token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'nonexistenttoken', newPassword: 'newpass123' })

    expect(res.status).toBe(400)
  })

  test('POST /api/auth/reset-password — succeeds with a valid reset token', async () => {
    const league = await createTestLeague()
    cleanup.push(league.id)
    const admin = await createTestAdmin(league.id)

    const resetToken = 'validtesttoken' + uid()
    const expiry     = new Date(Date.now() + 60 * 60 * 1000)
    await db.query(
      'UPDATE admins SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, expiry, admin.id]
    )

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'brandnewpassword' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBeDefined()
  })
})
