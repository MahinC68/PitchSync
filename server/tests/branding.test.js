const fs=require('fs/promises')
const os=require('os')
const path=require('path')
const sharp=require('sharp')
const request=require('supertest')
const db=require('../db')
const app=require('../index')
const {createTestLeague,createTestAdmin,createTestTeam,generateToken,cleanupLeague}=require('./helpers')

describe('League identity and persistent logos',()=>{
  let league,token,root,previous,png
  const cleanup=[]
  const api=(method,url,id=league.id)=>request(app)[method](url).set('Authorization',`Bearer ${token}`).set('X-League-Id',String(id))
  const upload=(buffer=png,mime='image/png',id=league.id)=>api('put','/api/branding/logo',id).attach('logo',buffer,{filename:'../../unsafe.png',contentType:mime})
  const identity=(id=league.id)=>request(app).get(`/api/branding/league/${id}`)
  beforeAll(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'pitchsync-branding-'));previous=process.env.LOGO_STORAGE_DIR;process.env.LOGO_STORAGE_DIR=root;png=await sharp({create:{width:64,height:64,channels:4,background:'#c6a868'}}).png().toBuffer()})
  beforeEach(async()=>{league=await createTestLeague();cleanup.push(league.id);const admin=await createTestAdmin(league.id);token=generateToken(admin.id,league.id)})
  afterAll(async()=>{for(const id of cleanup)await cleanupLeague(id);if(previous===undefined)delete process.env.LOGO_STORAGE_DIR;else process.env.LOGO_STORAGE_DIR=previous;await fs.rm(root,{recursive:true,force:true})})
  test('defaults to a placeholder reference; public identity excludes access codes and ownership',async()=>{
    expect((await identity()).body.data).toEqual({id:league.id,name:league.name,logo_key:null})
    for(const id of ['0','nope','2147483648'])expect((await identity(id)).status).toBe(400)
    expect((await identity(2147483647)).status).toBe(404)
  })
  test('secure upload returns a random WebP key and integrates with login, switching and General settings',async()=>{
    const response=await upload();expect(response.status).toBe(200)
    const key=response.body.data.logo_key
    expect(key).toMatch(/^[a-f0-9]{32}\.webp$/)
    const file=await fs.readFile(path.join(root,key)),metadata=await sharp(file).metadata()
    expect(metadata.format).toBe('webp');expect(metadata.exif).toBeUndefined();expect(file.equals(png)).toBe(false)
    const image=await request(app).get(`/api/league-logos/${key}`)
    expect(image.status).toBe(200);expect(image.headers['x-content-type-options']).toBe('nosniff');expect(image.headers['content-type']).toContain('image/webp')
    expect((await identity()).body.data.logo_key).toBe(key)
    expect((await api('get','/api/leagues')).body.data.find(item=>item.id===league.id).logo_key).toBe(key)
    expect((await api('get',`/api/leagues/${league.id}`)).body.data.logo_key).toBe(key)
    expect((await api('get','/api/auth/league')).body.data.logo_key).toBe(key)
    const {rows:[admin]}=await db.query('SELECT email FROM admins WHERE id=(SELECT admin_id FROM admin_leagues WHERE league_id=$1 LIMIT 1)',[league.id])
    const login=await request(app).post('/api/auth/login').send({email:admin.email,password:'password123'})
    expect(login.status).toBe(200);expect(login.body.leagues[0].logo_key).toBe(key)
  })
  test('replacement/removal clean old files; renaming preserves the logo and league ID',async()=>{
    const first=(await upload()).body.data.logo_key
    const renamed=await api('patch',`/api/leagues/${league.id}`).send({name:'Renamed league'})
    expect(renamed.body.data).toMatchObject({id:league.id,name:'Renamed league',logo_key:first})
    const second=(await upload()).body.data.logo_key
    expect(second).not.toBe(first);await expect(fs.access(path.join(root,first))).rejects.toBeDefined()
    expect((await api('delete','/api/branding/logo')).body.data).toEqual({id:league.id,name:'Renamed league',logo_key:null})
    await expect(fs.access(path.join(root,second))).rejects.toBeDefined()
    expect((await api('delete','/api/branding/logo')).status).toBe(200)
  })
  test('league/team logos remain independent and branding is scoped to the selected owned league',async()=>{
    const key=(await upload()).body.data.logo_key
    const other=(await api('post','/api/leagues').send({name:'Other branding'})).body.data;cleanup.push(other.id)
    const team=await createTestTeam(league.id)
    const teamUpload=await api('put',`/api/teams/${team.id}/logo`).attach('logo',png,{filename:'x.png',contentType:'image/png'})
    expect(teamUpload.status).toBe(200)
    expect(teamUpload.body.data.logo_key).not.toBe(key)
    const otherKey=(await upload(png,'image/png',other.id)).body.data.logo_key
    expect((await identity()).body.data.logo_key).toBe(key)
    expect((await identity(other.id)).body.data.logo_key).toBe(otherKey)
    await api('delete','/api/branding/logo',other.id)
    expect((await identity()).body.data.logo_key).toBe(key)
    expect((await api('get','/api/teams')).body.data[0].logo_key).toBe(teamUpload.body.data.logo_key)
    await expect(fs.access(path.join(root,key))).resolves.toBeUndefined()
  })
  test('invalid images and multipart requests leave the current logo intact',async()=>{
    const key=(await upload()).body.data.logo_key
    const wide=await sharp({create:{width:4097,height:1,channels:3,background:'#111'}}).png().toBuffer()
    for(const [buffer,mime] of [[Buffer.from('<svg onload="alert(1)"></svg>'),'image/png'],[png,'image/jpeg'],[png.subarray(0,12),'image/png'],[wide,'image/png']])expect((await upload(buffer,mime)).status).toBe(400)
    expect((await upload(Buffer.alloc(2*1024*1024+1))).status).toBe(413)
    expect((await api('put','/api/branding/logo')).status).toBe(400)
    expect((await api('put','/api/branding/logo').field('league_id',String(league.id)).attach('logo',png,{filename:'x.png',contentType:'image/png'})).status).toBe(400)
    expect((await identity()).body.data.logo_key).toBe(key)
  })
  test('requires ownership before buffering files or removing logos',async()=>{
    const foreign=await createTestLeague();cleanup.push(foreign.id)
    const before=(await fs.readdir(root)).length
    expect((await upload(png,'image/png',foreign.id)).status).toBe(403)
    expect((await api('delete','/api/branding/logo',foreign.id)).status).toBe(403)
    expect((await request(app).put('/api/branding/logo').attach('logo',png,{filename:'x.png',contentType:'image/png'})).status).toBe(401)
    expect((await request(app).delete('/api/branding/logo')).status).toBe(401)
    expect((await fs.readdir(root)).length).toBe(before)
  })
  test('storage failures preserve the existing reference and production requires a persistent path',async()=>{
    const key=(await upload()).body.data.logo_key
    const blocked=path.join(root,'file');await fs.writeFile(blocked,'blocked')
    try{process.env.LOGO_STORAGE_DIR=blocked;expect((await upload()).status).toBe(503)}finally{process.env.LOGO_STORAGE_DIR=root}
    const mode=process.env.NODE_ENV
    try{process.env.NODE_ENV='production';delete process.env.LOGO_STORAGE_DIR;expect((await upload()).body.error).toContain('League logo storage is not configured')}finally{process.env.NODE_ENV=mode;process.env.LOGO_STORAGE_DIR=root}
    expect((await identity()).body.data.logo_key).toBe(key)
  })
})
