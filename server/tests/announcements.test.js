const request=require('supertest')
const app=require('../index')
const db=require('../db')
const {createTestLeague,createTestAdmin,generateToken,cleanupLeague}=require('./helpers')

describe('League announcements',()=>{
  let league,token
  const cleanup=[]
  const api=(method,url,id=league.id)=>request(app)[method](url).set('Authorization',`Bearer ${token}`).set('X-League-Id',String(id))
  const publish=(title='Sunday matches',message='Matches are postponed.')=>api('post','/api/announcements').send({title,message})
  const list=(id=league.id,query='')=>request(app).get(`/api/announcements/league/${id}${query}`)
  beforeEach(async()=>{league=await createTestLeague();cleanup.push(league.id);const admin=await createTestAdmin(league.id);token=generateToken(admin.id,league.id)})
  afterAll(async()=>{for(const id of cleanup)await cleanupLeague(id)})
  test('publishes immediately with a server-assigned publication date and public league-scoped reading',async()=>{
    expect((await list()).body.data).toEqual({items:[],total:0,limit:20,offset:0})
    const start=Date.now(),response=await publish('  Sunday matches  ','  The pitch is closed.\nNew date soon.  ')
    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({title:'Sunday matches',message:'The pitch is closed.\nNew date soon.'})
    expect(new Date(response.body.data.published_at).getTime()).toBeGreaterThanOrEqual(start-1000)
    const publicList=(await list()).body.data
    expect(publicList.total).toBe(1)
    expect(publicList.items[0]).toMatchObject({id:response.body.data.id,title:'Sunday matches'})
    expect(publicList.items[0]).not.toHaveProperty('league_id');expect(publicList.items[0]).not.toHaveProperty('admin_id')
  })
  test('edits in place, preserves publication date, and deletes the announcement',async()=>{
    const item=(await publish()).body.data
    const changed=await api('put',`/api/announcements/${item.id}`).send({title:'New date confirmed',message:'Sunday at 15:00.'})
    expect(changed.status).toBe(200)
    expect(changed.body.data).toEqual({...item,title:'New date confirmed',message:'Sunday at 15:00.'})
    expect((await api('delete',`/api/announcements/${item.id}`)).status).toBe(200)
    expect((await list()).body.data.items).toEqual([])
    expect((await api('delete',`/api/announcements/${item.id}`)).status).toBe(404)
  })
  test('validates title/message bounds and rejects scheduled publishing or extra features',async()=>{
    for(const body of [{title:'',message:'x'},{title:' ',message:'x'},{title:'x',message:''},{title:'x'.repeat(121),message:'x'},{title:'x',message:'x'.repeat(5001)},{title:3,message:'x'},{title:'x',message:{}},{title:'x',message:'x',published_at:'2030-01-01'},{title:'x',message:'x',league_id:league.id},{title:'x',message:'x',description:'extra'}])expect((await api('post','/api/announcements').send(body)).status).toBe(400)
    expect((await publish('x'.repeat(120),'y'.repeat(5000))).status).toBe(201)
    const item=(await publish()).body.data
    expect((await api('put',`/api/announcements/${item.id}`).send({title:'x',message:'x',published_at:'2030-01-01'})).status).toBe(400)
    for(const id of ['nope','0','-1','2147483648'])expect((await api('delete',`/api/announcements/${id}`)).status).toBe(400)
    expect((await api('put','/api/announcements/2147483647').send({title:'x',message:'x'})).status).toBe(404)
  })
  test('keeps plain text unchanged, including text that resembles HTML',async()=>{
    const title='<img src=x onerror=alert(1)>',message='<script>alert(1)</script>\nhttps://example.com'
    expect((await publish(title,message)).status).toBe(201)
    expect((await list()).body.data.items[0]).toMatchObject({title,message})
  })
  test('paginates all announcements in stable publication order',async()=>{
    const ids=[];for(let i=0;i<23;i++)ids.push((await publish(`Update ${i}`)).body.data.id)
    // Identical dates still use ID order; editing an old item does not republish it.
    await db.query("UPDATE announcements SET published_at='2026-01-01' WHERE league_id=$1",[league.id])
    await api('put',`/api/announcements/${ids[0]}`).send({title:'Edited oldest',message:'Still oldest'})
    const dashboard=(await list(league.id,'?limit=3')).body.data
    expect(dashboard.total).toBe(23);expect(dashboard.items.map(item=>item.id)).toEqual(ids.slice(-3).reverse())
    const second=(await list(league.id,'?offset=20')).body.data
    expect(second.total).toBe(23);expect(second.items.map(item=>item.id)).toEqual(ids.slice(0,3).reverse())
    expect((await list(league.id,'?offset=100')).body.data).toMatchObject({items:[],total:23})
  })
  test('invalid pagination and unknown leagues produce useful errors',async()=>{
    for(const query of ['?limit=0','?limit=51','?limit=2.5','?offset=-1','?offset=abc','?offset=100001'])expect((await list(league.id,query)).status).toBe(400)
    expect((await list('nope')).status).toBe(400)
    expect((await list(2147483647)).status).toBe(404)
  })
  test('enforces ownership and active league for writes, even for another owned league',async()=>{
    const item=(await publish()).body.data
    const owned=(await api('post','/api/leagues').send({name:'Independent announcements'})).body.data;cleanup.push(owned.id)
    expect((await list(owned.id)).body.data.total).toBe(0)
    for(const method of ['put','delete'])expect((await api(method,`/api/announcements/${item.id}`,owned.id).send({title:'Wrong league',message:'Blocked'})).status).toBe(404)
    expect((await api('post','/api/announcements',owned.id).send({title:'Other league',message:'Isolated'})).status).toBe(201)
    expect((await list()).body.data.items[0].title).toBe(item.title)
    const foreign=await createTestLeague();cleanup.push(foreign.id)
    for(const [method,url,body] of [['post','/api/announcements',{title:'x',message:'x'}],['put',`/api/announcements/${item.id}`,{title:'x',message:'x'}],['delete',`/api/announcements/${item.id}`,{}]]){
      expect((await api(method,url,foreign.id).send(body)).status).toBe(403)
      expect((await request(app)[method](url).send(body)).status).toBe(401)
    }
    expect((await list()).body.data.items[0]).toMatchObject(item)
  })
})
