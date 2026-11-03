const request=require('supertest')
const app=require('../index')
const db=require('../db')
const {DEFAULT_RULES}=require('../services/rules')
const {createTestLeague,createTestAdmin,createTestTeam,createTestMatch,createTestPlayer,generateToken,cleanupLeague}=require('./helpers')

describe('Optional playoffs and qualification zones',()=>{
  let league,token,teams,bracket
  const cleanup=[]
  const api=(method,url,id=league.id)=>request(app)[method](url).set('Authorization',`Bearer ${token}`).set('X-League-Id',String(id))
  const competition=async(id=league.id)=>(await request(app).get(`/api/playoffs/league/${id}`)).body.data
  const standings=async()=>(await request(app).get(`/api/standings/${league.id}`)).body.data
  const settings=(qualifiers=4,third_place=false,enabled=true)=>api('put','/api/playoffs/settings').send({enabled,qualifiers,third_place})
  async function generate(qualifiers=4,third=false){expect((await settings(qualifiers,third)).status).toBe(200);const preview=await api('post','/api/playoffs/preview');expect(preview.status).toBe(200);const result=await api('post','/api/playoffs/bracket').send({token:preview.body.data.token});expect(result.status).toBe(200);bracket=result.body.data;return bracket}
  async function result(match,home_score=1,away_score=0,extra={}){const response=await api('put',`/api/playoffs/matches/${match.id}/result`).send({home_score,away_score,expected_revision:bracket.revision,...extra});if(response.status===200)bracket=response.body.data;return response}
  const match=(round,position=1,kind='main')=>bracket.matches.find(match=>match.round===round&&match.position===position&&match.kind===kind)
  beforeEach(async()=>{league=await createTestLeague();cleanup.push(league.id);const admin=await createTestAdmin(league.id);token=generateToken(admin.id,league.id);teams=[];for(let i=1;i<=4;i++)teams.push(await createTestTeam(league.id,`Club ${i}`));bracket=null})
  afterAll(async()=>{for(const id of cleanup)await cleanupLeague(id)})

  test('existing/new leagues default to disabled; settings validate and preserve other rules',async()=>{
    expect(await competition()).toEqual({settings:{enabled:false,qualifiers:4,third_place:false},bracket:null})
    expect((await standings()).every(team=>team.inQualificationZone===false)).toBe(true)
    for(const data of [{enabled:'true',qualifiers:4,third_place:false},{enabled:true,qualifiers:3,third_place:false},{enabled:true,qualifiers:2,third_place:true},{enabled:true,qualifiers:4,third_place:1},{enabled:true,qualifiers:4,third_place:false,league_id:1}])expect((await api('put','/api/playoffs/settings').send(data)).status).toBe(400)
    await settings(4,true)
    const before=(await api('get','/api/rules')).body.data
    await api('put','/api/rules').send({...DEFAULT_RULES,win_points:7})
    expect((await competition()).settings).toEqual({enabled:true,qualifiers:4,third_place:true})
    expect((await api('get','/api/rules')).body.data).toMatchObject({max_roster_size:before.max_roster_size,win_points:7})
  })
  test('requires enabled playoffs, sufficient teams and a current preview',async()=>{
    expect((await api('post','/api/playoffs/preview')).status).toBe(409)
    await settings(8)
    expect((await api('post','/api/playoffs/preview')).body.error).toContain('At least 8 teams')
    await settings(4)
    expect((await api('post','/api/playoffs/bracket').send({})).status).toBe(400)
    const preview=(await api('post','/api/playoffs/preview')).body.data
    await api('post','/api/rules/adjustments').send({team_id:teams[3].id,points:5,reason:'Changed qualification'})
    expect((await api('post','/api/playoffs/bracket').send({token:preview.token})).status).toBe(409)
    expect((await competition()).bracket).toBeNull()
  })
  test.each([2,4,8])('%i-team brackets use standard seeds and contain only knockout matches',async count=>{
    while(teams.length<count)teams.push(await createTestTeam(league.id,`Club ${teams.length+1}`))
    await generate(count,count>2)
    const pairs={2:[[1,2]],4:[[1,4],[2,3]],8:[[1,8],[4,5],[2,7],[3,6]]}[count]
    expect(bracket.entries.map(entry=>entry.team_id)).toEqual(teams.slice(0,count).map(team=>team.id))
    expect(bracket.matches.filter(match=>match.round===1).map(match=>[bracket.entries.find(entry=>entry.team_id===match.home_team_id).seed,bracket.entries.find(entry=>entry.team_id===match.away_team_id).seed])).toEqual(pairs)
    expect(bracket.matches).toHaveLength(count-1+(count>2?1:0))
    expect((await db.query('SELECT 1 FROM matches WHERE league_id=$1',[league.id])).rowCount).toBe(0)
    expect(bracket.matches.filter(match=>match.round>1).every(match=>match.home_team_id===null&&match.away_team_id===null)).toBe(true)
  })
  test('concurrent generation creates one bracket and returns a useful duplicate conflict',async()=>{
    await settings(4)
    const preview=(await api('post','/api/playoffs/preview')).body.data
    const responses=await Promise.all([1,2].map(()=>api('post','/api/playoffs/bracket').send({token:preview.token})))
    expect(responses.map(response=>response.status).sort()).toEqual([200,409])
    expect((await db.query('SELECT 1 FROM playoff_brackets WHERE league_id=$1',[league.id])).rowCount).toBe(1)
    expect((await api('post','/api/playoffs/preview')).status).toBe(409)
  })
  test('qualification uses custom points, reordered tiebreakers, adjustments and forfeits',async()=>{
    const [a,b,c,d]=teams
    await createTestMatch(league.id,a.id,b.id,{status:'completed',homeScore:1,awayScore:0})
    const forfeitable=await createTestMatch(league.id,c.id,d.id,{status:'completed',homeScore:5,awayScore:0})
    await createTestMatch(league.id,a.id,d.id,{status:'completed',homeScore:1,awayScore:0})
    await createTestMatch(league.id,c.id,b.id,{status:'completed',homeScore:0,awayScore:0})
    await settings(2)
    const rules={...DEFAULT_RULES,win_points:2,draw_points:2,forfeit_penalty:3}
    await api('put','/api/rules').send(rules)
    expect((await api('post','/api/playoffs/preview')).body.data.entries.map(entry=>entry.team_id)).toEqual([c.id,a.id])
    await api('put','/api/rules').send({...rules,tiebreakers:['total_wins','goal_difference','goals_scored','head_to_head']})
    expect((await api('post','/api/playoffs/preview')).body.data.entries.map(entry=>entry.team_id)).toEqual([a.id,c.id])
    await api('post','/api/rules/adjustments').send({team_id:d.id,points:10,reason:'Manual bonus'})
    await api('put',`/api/fixtures/${forfeitable.id}/forfeit`).send({forfeiting_team_id:c.id})
    const preview=(await api('post','/api/playoffs/preview')).body.data
    expect(preview.entries.map(entry=>entry.team_id)).toEqual([d.id,a.id])
    expect(preview.entries.map(entry=>entry.points)).toEqual((await standings()).slice(0,2).map(team=>team.pts))
    expect((await standings()).find(team=>team.teamId===c.id)).toMatchObject({forfeitPenalty:3,pts:-1})
  })
  test('head-to-head qualification shares the authoritative standings calculation',async()=>{
    const [a,b,c]=teams
    for(const [home,away] of [[a,b],[b,c],[c,a]])await createTestMatch(league.id,home.id,away.id,{status:'completed',homeScore:1,awayScore:0})
    await settings(2)
    await api('put','/api/rules').send({...DEFAULT_RULES,tiebreakers:['head_to_head','total_wins','goals_scored','goal_difference']})
    expect((await api('post','/api/playoffs/preview')).body.data.entries.map(entry=>entry.team_id)).toEqual((await standings()).slice(0,2).map(team=>team.teamId))
    expect((await standings()).slice(0,3).map(team=>team.teamId)).toEqual([a.id,b.id,c.id])
  })
  test.each([2,4,8])('progresses an entire %i-team competition and declares a champion',async count=>{
    while(teams.length<count)teams.push(await createTestTeam(league.id,`Club ${teams.length+1}`))
    await generate(count,count>2)
    for(let round=1;round<=Math.log2(count);round++)for(const row of bracket.matches.filter(match=>match.kind==='main'&&match.round===round))expect((await result(row)).status).toBe(200)
    expect(bracket.champion_id).toBe(teams[0].id)
    if(count>2){expect(bracket.completed).toBe(false);const third=match(Math.log2(count),1,'third');expect(third.home_team_id).toBeTruthy();expect(third.away_team_id).toBeTruthy();expect((await result(third,0,2)).status).toBe(200)}
    expect(bracket.completed).toBe(true)
  })
  test('draws require a participating penalty winner, stored separately from the score',async()=>{
    await generate(2);const final=match(1)
    expect((await result(final,1,1)).status).toBe(400)
    expect((await result(final,1,1,{penalty_winner_id:teams[3].id})).status).toBe(400)
    expect((await result(final,2,1,{penalty_winner_id:final.home_team_id})).status).toBe(400)
    expect((await result(final,1,1,{penalty_winner_id:final.away_team_id})).status).toBe(200)
    expect(match(1)).toMatchObject({home_score:1,away_score:1,winner_id:final.away_team_id,penalty_winner_id:final.away_team_id})
    expect(bracket.champion_id).toBe(final.away_team_id)
    for(const [home,away] of [[-1,0],[1.5,0],[100,0],['1',0]])expect((await result(match(1),home,away)).status).toBe(400)
  })
  test('blocks later results until participants advance and rejects unsupported scorer data',async()=>{
    await generate(4)
    expect((await result(match(2))).status).toBe(409)
    expect((await result(match(1),1,0,{scorers:[]})).status).toBe(400)
  })
  test('editing an earlier winner advances automatically when later matches are unplayed',async()=>{
    await generate(4,true)
    const semi=match(1);await result(semi)
    expect(match(2).home_team_id).toBe(semi.home_team_id)
    expect(match(2,1,'third').home_team_id).toBe(semi.away_team_id)
    await result(match(1),0,1)
    expect(match(2).home_team_id).toBe(semi.away_team_id)
    expect(match(2,1,'third').home_team_id).toBe(semi.home_team_id)
  })
  test('requires exact explicit resolution before clearing completed final and third-place results',async()=>{
    await generate(4,true);await result(match(1));await result(match(1,2));await result(match(2));await result(match(2,1,'third'))
    const before=await competition(),semi=match(1)
    // A score correction with the same winner preserves later results.
    expect((await result(semi,3,0)).status).toBe(200)
    expect(match(2).winner_id).toBeTruthy()
    const conflict=await result(semi,0,2)
    expect(conflict.status).toBe(409);expect(conflict.body.code).toBe('DOWNSTREAM_RESULTS')
    expect(conflict.body.details.affected.map(row=>row.id).sort()).toEqual([match(2).id,match(2,1,'third').id].sort())
    expect((await competition()).bracket.champion_id).toBe(before.bracket.champion_id)
    expect((await result(semi,0,2,{reset_match_ids:[match(2).id]})).status).toBe(409)
    expect((await result(semi,0,2,{reset_match_ids:conflict.body.details.affected.map(row=>row.id)})).status).toBe(200)
    expect(match(2)).toMatchObject({home_team_id:semi.away_team_id,home_score:null,winner_id:null,penalty_winner_id:null})
    expect(match(2,1,'third')).toMatchObject({home_team_id:semi.home_team_id,home_score:null,winner_id:null})
    expect(bracket.champion_id).toBeNull()
  })
  test('clearing a quarterfinal cascades only along its dependent path with explicit confirmation',async()=>{
    while(teams.length<8)teams.push(await createTestTeam(league.id,`Club ${teams.length+1}`))
    await generate(8,true)
    for(let round=1;round<=3;round++)for(const row of bracket.matches.filter(match=>match.kind==='main'&&match.round===round))await result(row)
    await result(match(3,1,'third'))
    const target=match(1),body={expected_revision:bracket.revision}
    const conflict=await api('delete',`/api/playoffs/matches/${target.id}/result`).send(body)
    expect(conflict.status).toBe(409)
    expect(conflict.body.details.affected.map(row=>row.label)).toEqual(['Semifinal 1','Final','Third-place match'])
    const saved=await api('delete',`/api/playoffs/matches/${target.id}/result`).send({...body,reset_match_ids:conflict.body.details.affected.map(row=>row.id)})
    expect(saved.status).toBe(200);bracket=saved.body.data
    expect(match(2,2).winner_id).toBeTruthy();expect(match(2).winner_id).toBeNull();expect(match(3).home_team_id).toBeNull();expect(match(3).away_team_id).toBeTruthy()
  })
  test('stale and concurrent edits cannot overwrite each other or confirm an outdated resolution',async()=>{
    await generate(4)
    const revision=bracket.revision,rows=bracket.matches.filter(row=>row.round===1)
    const responses=await Promise.all(rows.map(row=>api('put',`/api/playoffs/matches/${row.id}/result`).send({home_score:1,away_score:0,expected_revision:revision})))
    expect(responses.map(response=>response.status).sort()).toEqual([200,409])
    expect(responses.find(response=>response.status===409).body.code).toBe('STALE_BRACKET')
    expect((await api('put',`/api/playoffs/matches/${rows[0].id}/result`).send({home_score:2,away_score:0})).status).toBe(400)
  })
  test('qualification zones follow 2/4/8 configuration and disappear when disabled',async()=>{
    while(teams.length<9)teams.push(await createTestTeam(league.id,`Club ${teams.length+1}`))
    for(const count of [2,4,8]){await settings(count);const table=await standings();expect(table.filter(row=>row.inQualificationZone).map(row=>row.position)).toEqual(Array.from({length:count},(_,i)=>i+1))}
    await settings(8,false,false)
    expect((await standings()).some(row=>row.inQualificationZone)).toBe(false)
  })
  test('settings changes preserve an existing bracket, including disabled competitions',async()=>{
    await generate(4,true);const before=bracket
    await settings(2,false,false)
    expect((await competition()).bracket).toEqual(before)
    expect((await result(match(1))).status).toBe(200)
    await settings(8,false,true)
    expect((await competition()).bracket.qualifiers).toBe(4)
    expect((await api('post','/api/playoffs/preview')).status).toBe(409)
  })
  test('ownership, league switching and foreign match IDs are enforced for every mutation',async()=>{
    await generate(4)
    const other=(await api('post','/api/leagues').send({name:'Other owned league'})).body.data;cleanup.push(other.id)
    expect((await competition(other.id)).settings.enabled).toBe(false)
    expect((await api('put',`/api/playoffs/matches/${match(1).id}/result`,other.id).send({home_score:1,away_score:0,expected_revision:bracket.revision})).status).toBe(404)
    expect((await api('delete',`/api/playoffs/matches/${match(1).id}/result`,other.id).send({expected_revision:bracket.revision})).status).toBe(404)
    const foreign=await createTestLeague();cleanup.push(foreign.id)
    for(const [method,path,body] of [['put','settings',{enabled:true,qualifiers:2,third_place:false}],['post','preview',{}],['post','bracket',{token:'a'.repeat(64)}],['put',`matches/${match(1).id}/result`,{home_score:1,away_score:0,expected_revision:bracket.revision}],['delete',`matches/${match(1).id}/result`,{expected_revision:bracket.revision}]]){
      expect((await api(method,`/api/playoffs/${path}`,foreign.id).send(body)).status).toBe(403)
      expect((await request(app)[method](`/api/playoffs/${path}`).send(body)).status).toBe(401)
    }
    expect((await result({id:2147483647})).status).toBe(404)
    expect((await request(app).get('/api/playoffs/league/2147483647')).status).toBe(404)
    expect((await request(app).get('/api/playoffs/league/nope')).status).toBe(400)
  })
  test('regular fixtures, goals, leaderboards and standings are unchanged by playoff results and edits',async()=>{
    const fixture=await createTestMatch(league.id,teams[0].id,teams[1].id,{status:'completed',homeScore:1,awayScore:0})
    const player=await createTestPlayer(league.id,teams[0].id)
    const goal=(await api('post','/api/goals').send({match_id:fixture.id,player_id:player.id,team_id:teams[0].id})).body.data
    await settings(4,true)
    const before=await standings(),fixtures=(await request(app).get(`/api/fixtures/${league.id}`)).body.data,scorers=(await request(app).get(`/api/players/${league.id}/top-scorers`)).body.data
    await generate(4,true);await result(match(1),4,2);await result(match(1,2),1,1,{penalty_winner_id:match(1,2).away_team_id});await result(match(2),9,0)
    expect(await standings()).toEqual(before)
    expect((await request(app).get(`/api/fixtures/${league.id}`)).body.data).toEqual(fixtures)
    expect((await request(app).get(`/api/players/${league.id}/top-scorers`)).body.data).toEqual(scorers)
    expect((await api('get',`/api/goals/match/${fixture.id}`)).body.data).toMatchObject([{id:goal.id,player_id:player.id}])
    const remove=await api('delete',`/api/teams/${teams[3].id}`)
    expect(remove.status).toBe(409)
  })
})
