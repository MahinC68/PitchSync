const request = require('supertest')
const fs = require('fs')
const path = require('path')
const app = require('../index')
const db = require('../db')
const { DEFAULT_RULES } = require('../services/rules')
const { createTestLeague, createTestAdmin, createTestTeam, createTestMatch, createTestPlayer, generateToken, cleanupLeague } = require('./helpers')

describe('League rules, adjustments and forfeits', () => {
  let league, token, home, away, fixture
  const cleanup = []
  const api = (method, url, id = league.id, auth = token) => request(app)[method](url).set('Authorization', `Bearer ${auth}`).set('X-League-Id', String(id))
  const table = async () => (await request(app).get(`/api/standings/${league.id}`)).body.data
  beforeEach(async () => {
    league = await createTestLeague(); cleanup.push(league.id)
    const admin = await createTestAdmin(league.id); token = generateToken(admin.id, league.id)
    home = await createTestTeam(league.id); away = await createTestTeam(league.id)
    fixture = await createTestMatch(league.id, home.id, away.id, { status: 'completed', homeScore: 2, awayScore: 1 })
  })
  afterAll(async () => { for (const id of cleanup) await cleanupLeague(id) })
  test('new leagues automatically receive defaults and default points', async () => {
    const rules = await api('get','/api/rules')
    expect(rules.body.data).toMatchObject(DEFAULT_RULES)
    expect((await table()).find(team => team.teamId === home.id).pts).toBe(3)
  })
  test('points rules recalculate existing results without rewriting matches', async () => {
    const before = (await db.query('SELECT * FROM matches WHERE id=$1',[fixture.id])).rows[0]
    expect((await api('put','/api/rules').send({ ...DEFAULT_RULES, win_points: 5, draw_points: 2, loss_points: -1, match_duration: 45 })).status).toBe(200)
    const rows = await table()
    expect(rows.find(team => team.teamId === home.id)).toMatchObject({ pts: 5, recentPoints: 5 })
    expect(rows.find(team => team.teamId === away.id).pts).toBe(-1)
    expect((await db.query('SELECT * FROM matches WHERE id=$1',[fixture.id])).rows[0]).toEqual(before)
  })
  test('rejects fractional points, invalid tiebreakers, duration and forfeit settings', async () => {
    for (const override of [{ win_points: 1.5 },{ loss_points: -101 },{ tiebreakers: ['goal_difference','goal_difference','goals_scored','total_wins'] },{ tiebreakers: ['unknown'] },{ match_duration: 0 },{ match_duration: 301 },{ forfeit_winner_score: 0 },{ forfeit_loser_score: 3 },{ forfeit_penalty: -1 },{ forfeit_penalty: 0.5 }]) {
      expect((await api('put','/api/rules').send({ ...DEFAULT_RULES, ...override })).status).toBe(400)
    }
    expect((await api('get','/api/rules')).body.data).toMatchObject(DEFAULT_RULES)
  })
  test('settings, adjustments and forfeit operations enforce league ownership', async () => {
    const other = await createTestLeague(); cleanup.push(other.id)
    for (const [method,url,data] of [['get','/api/rules'],['put','/api/rules',DEFAULT_RULES],['get','/api/rules/adjustments'],['post','/api/rules/adjustments',{ team_id: home.id, points: 1, reason: 'test' }],['put',`/api/fixtures/${fixture.id}/forfeit`,{ forfeiting_team_id: home.id }],['delete',`/api/fixtures/${fixture.id}/forfeit`]]) {
      expect((await api(method,url,other.id).send(data || {})).status).toBe(403)
    }
    expect((await request(app).put('/api/rules').send(DEFAULT_RULES)).status).toBe(401)
    expect((await request(app).post('/api/rules/adjustments').send({})).status).toBe(401)
    expect((await request(app).put(`/api/fixtures/${fixture.id}/forfeit`).send({ forfeiting_team_id: home.id })).status).toBe(401)
  })
  test('rules changes do not affect another league owned by the same account', async () => {
    const created = await api('post','/api/leagues').send({ name:'Independent rules' }); const other = created.body.data; cleanup.push(other.id)
    await api('put','/api/rules').send({ ...DEFAULT_RULES, win_points: 7, match_duration: 30, forfeit_penalty: 4 })
    expect((await api('get','/api/rules',other.id)).body.data).toMatchObject(DEFAULT_RULES)
  })
  test('adjustments can be added, viewed, edited, reassigned and deleted', async () => {
    const minus = await api('post','/api/rules/adjustments').send({ team_id:home.id, points:-4, reason:'Disciplinary deduction' })
    const bonus = await api('post','/api/rules/adjustments').send({ team_id:home.id, points:2, reason:'Bonus' })
    expect(minus.status).toBe(201); expect(bonus.status).toBe(201)
    expect((await table()).find(team => team.teamId === home.id)).toMatchObject({ basePts:3, manualAdjustment:-2, pts:1 })
    expect((await api('get','/api/rules/adjustments')).body.data).toHaveLength(2)
    expect((await api('put',`/api/rules/adjustments/${minus.body.data.id}`).send({ team_id:away.id, points:-1, reason:'Corrected deduction' })).status).toBe(200)
    expect((await table()).find(team => team.teamId === home.id).pts).toBe(5)
    expect((await api('delete',`/api/rules/adjustments/${bonus.body.data.id}`)).status).toBe(200)
    expect((await table()).find(team => team.teamId === home.id).pts).toBe(3)
    expect((await table()).find(team => team.teamId === away.id).pts).toBe(-1)
    expect((await db.query('SELECT home_score,away_score FROM matches WHERE id=$1',[fixture.id])).rows[0]).toEqual({ home_score:2,away_score:1 })
  })
  test('adjustments reject invalid values and references from other leagues', async () => {
    const other = await createTestLeague(); cleanup.push(other.id); const team = await createTestTeam(other.id)
    for (const override of [{ points:0 },{ points:1.5 },{ points:1001 },{ reason:'   ' },{ reason:'x'.repeat(251) },{ team_id:'1' }]) {
      expect((await api('post','/api/rules/adjustments').send({ team_id:home.id, points:1, reason:'Valid', ...override })).status).toBe(400)
    }
    expect((await api('post','/api/rules/adjustments').send({ team_id:team.id, points:1, reason:'Foreign team' })).status).toBe(403)
    const adjustment = (await api('post','/api/rules/adjustments').send({ team_id:home.id, points:1, reason:'Valid' })).body.data
    const created = (await api('post','/api/leagues').send({ name:'Another owned league' })).body.data; cleanup.push(created.id)
    expect((await api('delete',`/api/rules/adjustments/${adjustment.id}`,created.id)).status).toBe(404)
    expect((await api('put',`/api/rules/adjustments/${adjustment.id}`,created.id).send({ team_id:home.id, points:10, reason:'Wrong scope' })).status).toBe(404)
  })
  test('forfeits preserve original scores and goals; awarded goals never become player goals', async () => {
    const player = await createTestPlayer(league.id,home.id)
    await db.query('INSERT INTO goals (match_id,player_id,team_id) VALUES ($1,$2,$3)',[fixture.id,player.id,home.id])
    const marked = await api('put',`/api/fixtures/${fixture.id}/forfeit`).send({ forfeiting_team_id:home.id })
    expect(marked.status).toBe(200)
    expect(marked.body.data).toMatchObject({ home_score:0, away_score:3, recorded_home_score:2, recorded_away_score:1 })
    expect((await table()).find(team => team.teamId === home.id)).toMatchObject({ gf:0,ga:3,pts:0 })
    expect((await table()).find(team => team.teamId === away.id)).toMatchObject({ gf:3,ga:0,pts:3 })
    const scorers = await request(app).get(`/api/players/${league.id}/top-scorers`)
    expect(scorers.body.data.find(row => row.playerId === player.id).goals).toBe(0)
    expect((await db.query('SELECT * FROM goals WHERE match_id=$1',[fixture.id])).rowCount).toBe(1)
    expect((await api('put',`/api/fixtures/${fixture.id}/result`).send({ home_score:9,away_score:9 })).status).toBe(409)
    expect((await api('delete',`/api/goals/match/${fixture.id}`)).status).toBe(403)
    expect((await api('post','/api/goals').send({ match_id:fixture.id, player_id:player.id, team_id:home.id })).status).toBe(403)
    expect((await api('delete',`/api/fixtures/${fixture.id}/forfeit`)).status).toBe(200)
    const restored = await table()
    expect(restored.find(team => team.teamId === home.id)).toMatchObject({ gf:2,ga:1,pts:3 })
    expect((await request(app).get(`/api/players/${league.id}/top-scorers`)).body.data.find(row => row.playerId === player.id).goals).toBe(1)
  })
  test('forfeit penalties are counted once and recorded defaults remain historical snapshots', async () => {
    await api('put','/api/rules').send({ ...DEFAULT_RULES, forfeit_penalty:2, forfeit_winner_score:4 })
    expect((await api('put',`/api/fixtures/${fixture.id}/forfeit`).send({ forfeiting_team_id:away.id })).status).toBe(200)
    expect((await api('put',`/api/fixtures/${fixture.id}/forfeit`).send({ forfeiting_team_id:away.id })).status).toBe(409)
    await api('post','/api/rules/adjustments').send({ team_id:away.id,points:-1,reason:'Separate deduction' })
    await api('put','/api/rules').send({ ...DEFAULT_RULES, win_points:5, forfeit_penalty:7, forfeit_winner_score:8 })
    for (let read=0;read<2;read++) expect((await table()).find(team => team.teamId === away.id)).toMatchObject({ pts:-3,forfeitPenalty:2,manualAdjustment:-1,ga:4 })
    expect((await table()).find(team => team.teamId === home.id).pts).toBe(5)
    expect((await db.query('SELECT count(*)::int AS count FROM points_adjustments WHERE league_id=$1',[league.id])).rows[0].count).toBe(1)
  })
  test('scheduled forfeits can be cleared back to scheduled without inventing scores', async () => {
    const scheduled = await createTestMatch(league.id,home.id,away.id)
    expect((await api('put',`/api/fixtures/${scheduled.id}/forfeit`).send({ forfeiting_team_id:home.id })).status).toBe(200)
    expect((await request(app).get(`/api/fixtures/${league.id}`)).body.data.past.some(row => row.id === scheduled.id)).toBe(true)
    await api('delete',`/api/fixtures/${scheduled.id}/forfeit`)
    expect((await db.query('SELECT status,home_score,away_score FROM matches WHERE id=$1',[scheduled.id])).rows[0]).toEqual({ status:'scheduled',home_score:null,away_score:null })
  })
  test('forfeiting team must play in the owned fixture', async () => {
    const otherTeam = await createTestTeam(league.id)
    expect((await api('put',`/api/fixtures/${fixture.id}/forfeit`).send({ forfeiting_team_id:otherTeam.id })).status).toBe(400)
    const other = (await api('post','/api/leagues').send({ name:'Other scope' })).body.data;cleanup.push(other.id)
    expect((await api('put',`/api/fixtures/${fixture.id}/forfeit`,other.id).send({ forfeiting_team_id:home.id })).status).toBe(404)
  })
})

test('rules migration is repeatable and preserves existing match values', async () => {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const before = (await client.query('SELECT id,home_score,away_score,status FROM matches ORDER BY id')).rows
    const sql = fs.readFileSync(path.join(__dirname,'../db/migrations/002_league_rules.sql'),'utf8')
    await client.query(sql);await client.query(sql)
    expect((await client.query('SELECT id,home_score,away_score,status FROM matches ORDER BY id')).rows).toEqual(before)
    expect((await client.query('SELECT id FROM leagues WHERE id NOT IN (SELECT league_id FROM league_rules)')).rowCount).toBe(0)
  } finally { await client.query('ROLLBACK'); client.release() }
})
