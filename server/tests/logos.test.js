const fs=require('fs/promises')
const os=require('os')
const path=require('path')
const sharp=require('sharp')
const request=require('supertest')
const db=require('../db')
const app=require('../index')
const {createTestLeague,createTestAdmin,createTestTeam,createTestMatch,generateToken,cleanupLeague}=require('./helpers')

describe('Validated persistent team logos',()=>{
  let root,previous,league,token,team,png
  const cleanup=[]
  const api=(method,url,id=league.id)=>request(app)[method](url).set('Authorization',`Bearer ${token}`).set('X-League-Id',String(id))
  const upload=(buffer=png,mime='image/png',id=team.id)=>api('put',`/api/teams/${id}/logo`).attach('logo',buffer,{filename:'../../not-used.png',contentType:mime})
  beforeAll(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'pitchsync-logos-'));previous=process.env.LOGO_STORAGE_DIR;process.env.LOGO_STORAGE_DIR=root;png=await sharp({create:{width:40,height:40,channels:4,background:'#c6a868'}}).png().toBuffer()})
  beforeEach(async()=>{league=await createTestLeague();cleanup.push(league.id);const admin=await createTestAdmin(league.id);token=generateToken(admin.id,league.id);team=await createTestTeam(league.id)})
  afterAll(async()=>{for(const id of cleanup)await cleanupLeague(id);if(previous===undefined)delete process.env.LOGO_STORAGE_DIR;else process.env.LOGO_STORAGE_DIR=previous;await fs.rm(root,{recursive:true,force:true})})
  test('upload decodes/re-encodes to a random WebP reference and serves safe image headers',async()=>{
    const response=await upload()
    expect(response.status).toBe(200)
    const key=response.body.data.logo_key
    expect(key).toMatch(/^[a-f0-9]{32}\.webp$/)
    const bytes=await fs.readFile(path.join(root,key)),metadata=await sharp(bytes).metadata()
    expect(metadata.format).toBe('webp');expect(metadata.exif).toBeUndefined();expect(metadata.width).toBeLessThanOrEqual(256)
    expect(bytes.equals(png)).toBe(false)
    const publicImage=await request(app).get(`/api/team-logos/${key}`)
    expect(publicImage.status).toBe(200);expect(publicImage.headers['content-type']).toContain('image/webp');expect(publicImage.headers['x-content-type-options']).toBe('nosniff')
    expect((await api('get','/api/teams')).body.data[0].logo_key).toBe(key)
    expect((await request(app).get(`/api/standings/${league.id}`)).body.data[0].teamLogo).toBe(key)
    const away=await createTestTeam(league.id);await createTestMatch(league.id,team.id,away.id,{status:'completed',homeScore:1,awayScore:0})
    expect((await request(app).get(`/api/fixtures/${league.id}`)).body.data.past[0].home_team_logo).toBe(key)
  })
  test('replace and remove update references and clean obsolete stored files',async()=>{
    const first=(await upload()).body.data.logo_key,second=(await upload()).body.data.logo_key
    expect(second).not.toBe(first)
    await expect(fs.access(path.join(root,first))).rejects.toBeDefined()
    expect((await request(app).get(`/api/team-logos/${first}`)).status).toBe(404)
    expect((await api('delete',`/api/teams/${team.id}/logo`)).body.data.logo_key).toBeNull()
    await expect(fs.access(path.join(root,second))).rejects.toBeDefined()
    expect((await api('delete',`/api/teams/${team.id}/logo`)).status).toBe(200)
  })
  test('invalid, spoofed, oversized and excessive-dimension images do not replace the current logo',async()=>{
    const existing=(await upload()).body.data.logo_key
    const wide=await sharp({create:{width:4097,height:1,channels:3,background:'#111'}}).png().toBuffer()
    for(const [buffer,mime] of [[Buffer.from('<svg onload="alert(1)"></svg>'),'image/png'],[png,'image/jpeg'],[Buffer.from('not an image'),'image/png'],[png.subarray(0,12),'image/png'],[wide,'image/png']])expect((await upload(buffer,mime)).status).toBe(400)
    expect((await upload(Buffer.alloc(2*1024*1024+1),'image/png')).status).toBe(413)
    expect((await api('get','/api/teams')).body.data[0].logo_key).toBe(existing)
    expect((await api('put',`/api/teams/${team.id}/logo`)).status).toBe(400)
  })
  test('cross-league and unauthenticated uploads/removal are rejected before writing files',async()=>{
    const other=await createTestLeague();cleanup.push(other.id);const otherTeam=await createTestTeam(other.id)
    const before=(await fs.readdir(root)).length
    expect((await upload(png,'image/png',otherTeam.id)).status).toBe(404)
    expect((await api('delete',`/api/teams/${otherTeam.id}/logo`)).status).toBe(404)
    expect((await api('put',`/api/teams/${team.id}/logo`,other.id).attach('logo',png,{filename:'x.png',contentType:'image/png'})).status).toBe(403)
    expect((await request(app).put(`/api/teams/${team.id}/logo`).attach('logo',png,{filename:'x.png',contentType:'image/png'})).status).toBe(401)
    expect((await fs.readdir(root)).length).toBe(before)
  })
  test('production refuses ephemeral defaults and relative storage paths',async()=>{
    const mode=process.env.NODE_ENV
    try{process.env.NODE_ENV='production';delete process.env.LOGO_STORAGE_DIR;expect((await upload()).status).toBe(503);process.env.LOGO_STORAGE_DIR='relative';expect((await upload()).status).toBe(503)}finally{process.env.NODE_ENV=mode;process.env.LOGO_STORAGE_DIR=root}
  })
  test('failed storage leaves the existing reference untouched',async()=>{
    const existing=(await upload()).body.data.logo_key
    const blocked=path.join(root,'not-a-directory');await fs.writeFile(blocked,'file')
    try{process.env.LOGO_STORAGE_DIR=blocked;expect((await upload()).status).toBe(503)}finally{process.env.LOGO_STORAGE_DIR=root}
    expect((await api('get','/api/teams')).body.data[0].logo_key).toBe(existing)
  })
  test('delete cleans an unused team logo but preserves it if fixture constraints prevent deletion',async()=>{
    const first=(await upload()).body.data.logo_key
    expect((await api('delete',`/api/teams/${team.id}`)).status).toBe(200)
    await expect(fs.access(path.join(root,first))).rejects.toBeDefined()
    team=await createTestTeam(league.id);const second=(await upload()).body.data.logo_key
    const away=await createTestTeam(league.id);await createTestMatch(league.id,team.id,away.id)
    expect((await api('delete',`/api/teams/${team.id}`)).status).toBe(409)
    await expect(fs.access(path.join(root,second))).resolves.toBeUndefined()
  })
})
