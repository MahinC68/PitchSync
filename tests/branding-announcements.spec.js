import {test,expect} from '@playwright/test'
import {createRequire} from 'node:module'
const sharp=createRequire(new URL('../server/package.json',import.meta.url))('sharp')
const api=process.env.PITCHSYNC_TEST_API_URL||'http://localhost:3000'
const headers=(token,id)=>({Authorization:`Bearer ${token}`,'X-League-Id':String(id)})
async function register(request,prefix){const email=`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2,8)}@example.com`;const account=await(await request.post(`${api}/api/auth/register`,{data:{email,password:'password123',leagueName:'Gold Sunday League'}})).json();return{...account,email}}
async function login(page,email){await page.goto('/login?tab=admin');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('password123');await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL('**/standings')}
async function switchTo(page,name){await page.getByRole('button',{name:'Switch league',exact:true}).click();await page.getByRole('dialog',{name:'Switch league picker',exact:true}).getByRole('button',{name:new RegExp(name)}).first().click();await expect(page.getByRole('button',{name:'Switch league',exact:true})).toContainText(name);await expect(page.getByText('Switching league…',{exact:true})).toHaveCount(0)}

test('branding, organized settings and announcements stay independent across leagues and player access',async({page,request,browser})=>{
  const account=await register(request,'branding'),a=account.league
  const b=(await(await request.post(`${api}/api/leagues`,{headers:headers(account.token,a.id),data:{name:'Silver League'}})).json()).data
  const image=await sharp({create:{width:64,height:64,channels:4,background:'#c6a868'}}).png().toBuffer()
  const bLogo=(await(await request.put(`${api}/api/branding/logo`,{headers:headers(account.token,b.id),multipart:{logo:{name:'b.png',mimeType:'image/png',buffer:image}}})).json()).data.logo_key
  await request.post(`${api}/api/announcements`,{headers:headers(account.token,b.id),data:{title:'Silver league only',message:'This update belongs to Silver.'}})
  await login(page,account.email)
  await page.getByRole('link',{name:'Settings',exact:true}).click()
  const general=page.getByRole('region',{name:'General settings',exact:true})
  await expect(general.getByRole('heading',{name:'General',exact:true})).toBeVisible()
  for(const title of ['League Rules','Competition','Teams & Players','Announcements'])await expect(page.getByRole('link',{name:new RegExp(`^${title.replace('&','&')}`)})).toBeVisible()
  await expect(page.getByRole('link',{name:/Manage Players/})).toHaveCount(0)
  await general.getByLabel('League logo file',{exact:true}).setInputFiles({name:'league.png',mimeType:'image/png',buffer:image});await expect(general.getByRole('status')).toContainText('League logo updated')
  const aLogo=(await(await request.get(`${api}/api/branding/league/${a.id}`)).json()).data.logo_key
  await expect(general.locator('img').first()).toHaveAttribute('src',`${api}/api/league-logos/${aLogo}`)
  await expect(page.getByRole('button',{name:'Switch league',exact:true}).locator('img')).toHaveAttribute('src',`${api}/api/league-logos/${aLogo}`)
  await general.getByRole('button',{name:'Rename league',exact:true}).click();const rename=page.getByRole('dialog',{name:'Rename league',exact:true});await rename.getByLabel('League name',{exact:true}).fill('Gold Premier League');await rename.getByRole('button',{name:'Rename league',exact:true}).click();await expect(general.getByText('Gold Premier League',{exact:true}).first()).toBeVisible()
  await general.getByLabel('League logo file',{exact:true}).setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:image})
  await expect.poll(async()=>(await(await request.get(`${api}/api/branding/league/${a.id}`)).json()).data.logo_key).not.toBe(aLogo)
  const replacement=(await(await request.get(`${api}/api/branding/league/${a.id}`)).json()).data.logo_key
  await expect(general.locator('img').first()).toHaveAttribute('src',`${api}/api/league-logos/${replacement}`)
  await page.getByRole('main').evaluate(node=>node.scrollTop=0);await page.screenshot({path:'/tmp/pitchsync-phase6-general.png'})
  await page.getByRole('link',{name:/^Announcements/}).click();await page.getByRole('button',{name:'+ New announcement',exact:true}).click()
  let dialog=page.getByRole('dialog',{name:'New announcement',exact:true})
  await dialog.getByLabel('Announcement title',{exact:true}).fill('Sunday postponed');await dialog.getByLabel('Announcement message',{exact:true}).fill('Matches have moved.\nA new date will be shared here.');await dialog.getByRole('button',{name:'Publish announcement',exact:true}).click();await expect(dialog).toHaveCount(0)
  let card=page.getByRole('article',{name:'Sunday postponed',exact:true});await expect(card).toBeVisible();const publication=await card.locator('time').getAttribute('datetime')
  await card.getByRole('button',{name:'Edit announcement',exact:true}).click();dialog=page.getByRole('dialog',{name:'Edit announcement',exact:true});await dialog.getByLabel('Announcement title',{exact:true}).fill('Sunday rescheduled');await dialog.getByRole('button',{name:'Save announcement',exact:true}).click();await expect(dialog).toHaveCount(0)
  card=page.getByRole('article',{name:'Sunday rescheduled',exact:true});await expect(card.locator('time')).toHaveAttribute('datetime',publication)
  for(const title of ['Registration','Playoff bracket','Next matchday'])await request.post(`${api}/api/announcements`,{headers:headers(account.token,a.id),data:{title,message:`${title} details.`}})
  await page.getByRole('link',{name:'Standings',exact:true}).click()
  await expect(page.getByRole('group',{name:'League header'}).locator('img')).toHaveAttribute('src',`${api}/api/league-logos/${replacement}`)
  const panel=page.getByRole('region',{name:'League announcements',exact:true})
  await expect(panel.locator('details')).toHaveCount(3);await expect(panel.getByText('Sunday rescheduled',{exact:true})).toHaveCount(0);await expect(panel.locator('details p').first()).toBeHidden();await panel.locator('summary').first().click();await expect(panel.locator('details p').first()).toBeVisible()
  await page.getByRole('main').evaluate(node=>node.scrollTop=0);await page.screenshot({path:'/tmp/pitchsync-phase6-dashboard.png'})
  await panel.getByRole('link',{name:'View all announcements →',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(4);await expect(page.getByRole('article',{name:'Sunday rescheduled',exact:true})).toBeVisible()
  await switchTo(page,'Silver League');await expect(page.getByRole('article')).toHaveCount(1);await expect(page.getByRole('article',{name:'Silver league only',exact:true})).toBeVisible();await expect(page.getByText('Sunday rescheduled',{exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Switch league',exact:true}).locator('img')).toHaveAttribute('src',`${api}/api/league-logos/${bLogo}`)
  await page.getByRole('button',{name:'Switch league',exact:true}).click();await expect(page.getByRole('dialog',{name:'Switch league picker'}).locator('img')).toHaveCount(2);await page.keyboard.press('Escape')
  await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('link',{name:/^Announcements/}).click()
  await page.getByRole('article',{name:'Silver league only',exact:true}).getByRole('button',{name:'Edit announcement',exact:true}).click();await expect(page.getByRole('dialog',{name:'Edit announcement',exact:true})).toBeVisible()
  // Another tab switches the active league while the editor is open.
  const tab=await page.context().newPage();await tab.goto('/standings');await tab.evaluate(({id,name,logo})=>{const session=JSON.parse(localStorage.getItem('pitchsync'));localStorage.setItem('pitchsync',JSON.stringify({...session,leagueId:id,LeagueId:id,leagueName:name,LeagueName:name,leagueLogo:logo}))},{id:a.id,name:'Gold Premier League',logo:replacement});await tab.close()
  await expect(page.getByRole('dialog',{name:'Edit announcement',exact:true})).toHaveCount(0);await expect(page.getByRole('article',{name:'Sunday rescheduled',exact:true})).toBeVisible();await expect(page.getByText('Silver league only',{exact:true})).toHaveCount(0)
  await page.getByRole('article',{name:'Sunday rescheduled',exact:true}).getByRole('button',{name:'Delete announcement',exact:true}).click();await page.getByRole('button',{name:'Confirm delete announcement',exact:true}).click();await expect(page.getByRole('article',{name:'Sunday rescheduled',exact:true})).toHaveCount(0)
  await page.getByRole('link',{name:'Settings',exact:true}).click();await general.getByRole('button',{name:'Remove league logo',exact:true}).click();await expect(general.locator('img')).toHaveCount(0);await expect(page.getByRole('button',{name:'Switch league',exact:true}).locator('img')).toHaveCount(0)
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'/tmp/pitchsync-phase6-mobile.png'})
  const playerContext=await browser.newContext(),player=await playerContext.newPage()
  await player.goto(`${process.env.PITCHSYNC_TEST_BASE_URL||'http://localhost:5173'}/login`);await player.getByLabel('League Access Code',{exact:true}).fill(b.access_code);await player.getByRole('button',{name:'Join League',exact:true}).click();await player.waitForURL('**/standings')
  await expect(player.getByRole('region',{name:'League announcements'})).toContainText('Silver league only');await expect(player.getByRole('group',{name:'League header'}).locator('img')).toHaveAttribute('src',`${api}/api/league-logos/${bLogo}`)
  await player.getByRole('link',{name:'View all announcements →',exact:true}).click();await expect(player.getByRole('article',{name:'Silver league only',exact:true})).toBeVisible();await expect(player.getByRole('button',{name:/Edit announcement|Delete announcement|New announcement/})).toHaveCount(0)
  await player.goto(`${process.env.PITCHSYNC_TEST_BASE_URL||'http://localhost:5173'}/settings/announcements`);await player.waitForURL('**/standings');await playerContext.close()
})

test('late branding and announcement responses cannot display data from a previous league',async({page,request})=>{
  const account=await register(request,'late-branding'),a=account.league
  const b=(await(await request.post(`${api}/api/leagues`,{headers:headers(account.token,a.id),data:{name:'Active New League'}})).json()).data
  await request.post(`${api}/api/announcements`,{headers:headers(account.token,a.id),data:{title:'Old league announcement',message:'Must not appear after switching.'}})
  await request.post(`${api}/api/announcements`,{headers:headers(account.token,b.id),data:{title:'Current league announcement',message:'Only this league.'}})
  const waiting=[],seen=[];let completed=0
  await page.route(`${api}/api/branding/league/${a.id}`,async route=>{const response=await route.fetch();seen.push('branding');await new Promise(resolve=>waiting.push(resolve));await route.fulfill({response});completed++})
  await page.route(`${api}/api/announcements/league/${a.id}?*`,async route=>{const response=await route.fetch();seen.push('announcements');await new Promise(resolve=>waiting.push(resolve));await route.fulfill({response});completed++})
  await login(page,account.email);await expect.poll(()=>new Set(seen).size).toBe(2)
  await switchTo(page,b.name);await expect(page.getByRole('region',{name:'League announcements'})).toContainText('Current league announcement')
  for(const release of waiting)release();await expect.poll(()=>completed).toBe(seen.length)
  await expect(page.getByRole('group',{name:'League header'})).toContainText(b.name)
  await expect(page.getByText('Old league announcement',{exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Switch league',exact:true})).toContainText(b.name)
})
