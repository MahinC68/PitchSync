const request = require('supertest')
const app     = require('../index')
const {
  createTestLeague, createTestAdmin, generateToken,
  createTestTeam, createTestMatch, cleanupLeague,
} = require('./helpers')

describe('Standings routes', () => {
  let league, admin, token, teamA, teamB, teamC

  beforeAll(async () => {
    league = await createTestLeague()
    admin  = await createTestAdmin(league.id)
    token  = generateToken(admin.id, league.id)
    teamA  = await createTestTeam(league.id, 'Alpha')
    teamB  = await createTestTeam(league.id, 'Beta')
    teamC  = await createTestTeam(league.id, 'Gamma')

    // Alpha 2-0 Beta  → Alpha: W(3pts, GD+2),  Beta: L(0pts, GD-2)
    await createTestMatch(league.id, teamA.id, teamB.id, {
      status: 'completed', homeScore: 2, awayScore: 0, date: '2025-01-01',
    })
    // Alpha 1-1 Gamma → Alpha: D(4pts, GD+2),  Gamma: D(1pt, GD0)
    await createTestMatch(league.id, teamA.id, teamC.id, {
      status: 'completed', homeScore: 1, awayScore: 1, date: '2025-01-08',
    })
    // Beta  1-0 Gamma → Beta:  W(3pts, GD-1),  Gamma: L(1pt, GD-1)
    await createTestMatch(league.id, teamB.id, teamC.id, {
      status: 'completed', homeScore: 1, awayScore: 0, date: '2025-01-15',
    })
  })

  afterAll(async () => {
    await cleanupLeague(league.id)
  })

  test('GET /api/standings/:league_id — returns array with correct shape', async () => {
    const res = await request(app).get(`/api/standings/${league.id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(3)

    const row = res.body.data[0]
    for (const field of ['position', 'teamId', 'teamName', 'mp', 'w', 'd', 'l', 'gf', 'ga', 'gd', 'pts', 'form']) {
      expect(row).toHaveProperty(field)
    }
  })

  test('standings are sorted by points descending', async () => {
    const res  = await request(app).get(`/api/standings/${league.id}`)
    const data = res.body.data

    // Alpha: 4pts, Beta: 3pts, Gamma: 1pt
    expect(data[0].teamName).toBe('Alpha')
    expect(data[0].pts).toBe(4)
    expect(data[1].pts).toBe(3)
    expect(data[2].pts).toBe(1)

    for (let i = 0; i < data.length - 1; i++) {
      expect(data[i].pts).toBeGreaterThanOrEqual(data[i + 1].pts)
    }
  })

  test('teams tied on points are ordered by goal difference', async () => {
    const l2 = await createTestLeague()
    try {
      const highGD = await createTestTeam(l2.id, 'HighGD')
      const lowGD  = await createTestTeam(l2.id, 'LowGD')
      const bag    = await createTestTeam(l2.id, 'Punchingbag')

      // HighGD 3-0 Punchingbag → HighGD: 3pts, GD+3
      await createTestMatch(l2.id, highGD.id, bag.id, {
        status: 'completed', homeScore: 3, awayScore: 0, date: '2025-02-01',
      })
      // LowGD 1-0 Punchingbag → LowGD: 3pts, GD+1
      await createTestMatch(l2.id, lowGD.id, bag.id, {
        status: 'completed', homeScore: 1, awayScore: 0, date: '2025-02-08',
      })

      const res   = await request(app).get(`/api/standings/${l2.id}`)
      const names = res.body.data.map(t => t.teamName)

      expect(names[0]).toBe('HighGD')
      expect(names[1]).toBe('LowGD')
    } finally {
      await cleanupLeague(l2.id)
    }
  })

  test('form array contains correct W / D / L values', async () => {
    const res   = await request(app).get(`/api/standings/${league.id}`)
    const alpha = res.body.data.find(t => t.teamName === 'Alpha')

    expect(alpha.form).toContain('W')
    expect(alpha.form).toContain('D')
    expect(alpha.form.length).toBeLessThanOrEqual(5)
    expect(alpha.form.every(f => ['W', 'D', 'L'].includes(f))).toBe(true)

    const beta = res.body.data.find(t => t.teamName === 'Beta')
    expect(beta.form).toContain('L')
    expect(beta.form).toContain('W')
  })
})
