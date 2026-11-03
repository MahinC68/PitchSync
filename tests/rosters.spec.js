import {test,expect} from '@playwright/test'
import {createRequire} from 'node:module'
const sharp=createRequire(new URL('../server/package.json',import.meta.url))('sharp')

test('team roster limits, logos, player renames and atomic result entry stay connected',async({page,request})=>{
  const api=process.env.PITCHSYNC_TEST_API_URL||'http://localhost:3000'
  const email=`roster-${Date.now()}-${Math.random().toString(16).slice(2,8)}@example.com`
  const account=(await(await request.post(`${api}/api/auth/register`,{data:{email,password:'password123',leagueName:'Roster browser verification'}})).json())
  const headers={Authorization:`Bearer ${account.token}`,'X-League-Id':String(account.league.id)}
  const png=await sharp({create:{width:32,height:32,channels:4,background:'#c6a868'}}).png().toBuffer()
  const teams=async()=>(await(await request.get(`${api}/api/teams`,{headers})).json()).data
  await page.goto('/login?tab=admin');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('password123');await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL('**/standings')
  async function management(players=false){await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('link',{name:players?/Manage Players/:/Manage Teams/}).click();await expect(page.getByRole('heading',{name:'Teams & Players',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Maximum roster size',exact:true})).toBeVisible()}
  async function limit(value){await page.getByRole('button',{name:'Maximum roster size',exact:true}).click();await page.getByRole('button',{name:value===null?'Unlimited':'Custom limit',exact:true}).click();if(value!==null)await page.getByLabel('Custom roster limit',{exact:true}).fill(String(value));await page.getByRole('button',{name:'Save roster limit',exact:true}).click();await expect(page.getByText('Roster limit saved. Existing players are retained.',{exact:true})).toBeVisible()}
  async function createTeam(name){await page.getByLabel('Team name',{exact:true}).fill(name);await page.getByRole('button',{name:'+ Add Team',exact:true}).click();await expect(page.getByRole('region',{name:'Selected team'}).getByRole('heading',{name,exact:true})).toBeVisible()}
  async function addPlayer(name){await page.getByLabel('Player name',{exact:true}).fill(name);await page.getByRole('button',{name:'+ Add Player',exact:true}).click();await expect(page.getByText(name,{exact:true})).toBeVisible()}
  await management();await limit(1);await createTeam('Alpha FC');await addPlayer('Scorer original')
  await expect(page.getByRole('button',{name:'+ Add Player',exact:true})).toBeDisabled()
  await limit(null);await addPlayer('Eligible reserve');await limit(1)
  await expect(page.getByText(/This roster exceeds the new limit/)).toBeVisible()
  await expect(page.getByText('Eligible reserve',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Delete Eligible reserve',exact:true}).click();await page.getByRole('button',{name:'Confirm delete player',exact:true}).click();await expect(page.getByText('Eligible reserve',{exact:true})).toHaveCount(0)
  await page.getByLabel('Team logo file',{exact:true}).setInputFiles({name:'team.png',mimeType:'image/png',buffer:png});await expect(page.getByText('Team logo saved.',{exact:true})).toBeVisible()
  let alpha=(await teams()).find(team=>team.name==='Alpha FC');const originalKey=alpha.logo_key
  expect(originalKey).toMatch(/^[a-f0-9]{32}\.webp$/)
  await expect(page.getByRole('region',{name:'Selected team'}).locator('img')).toHaveJSProperty('naturalWidth',32)
  await page.getByLabel('Team logo file',{exact:true}).setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});await expect.poll(async()=>(await teams()).find(team=>team.id===alpha.id).logo_key).not.toBe(originalKey)
  await createTeam('Beta FC')
  const beta=(await teams()).find(team=>team.name==='Beta FC')
  const scorer=(await(await request.get(`${api}/api/players/team/${alpha.id}`,{headers})).json()).data[0]
  const match=(await(await request.post(`${api}/api/fixtures`,{headers,data:{home_team_id:alpha.id,away_team_id:beta.id,date:'2026-11-20',time:'15:00'}})).json()).data
  await page.getByRole('link',{name:'Schedule',exact:true}).click();await page.getByRole('button',{name:'+ Add Result',exact:true}).click()
  const modal=page.locator('[class*="modal"]').filter({has:page.getByRole('heading',{name:'Add Result',exact:true})}).first()
  await modal.locator('input[type=number]').nth(0).fill('1');await modal.locator('input[type=number]').nth(1).fill('0')
  await modal.getByRole('button',{name:'Goal 1',exact:true}).click();await page.getByRole('button',{name:'+ Add new player…',exact:true}).click();await modal.getByPlaceholder('Enter player name').fill('Blocked scorer')
  await modal.getByRole('button',{name:'Save Result',exact:true}).click();await expect(modal.getByText(/has reached its roster limit/)).toBeVisible()
  const unchanged=(await(await request.get(`${api}/api/fixtures/${account.league.id}`)).json()).data
  expect(unchanged.upcoming.find(item=>item.id===match.id)).toMatchObject({home_score:null,away_score:null})
  await modal.getByRole('button',{name:'Goal 1',exact:true}).click();await page.getByRole('button',{name:'Scorer original',exact:true}).click();await modal.getByRole('button',{name:'Save Result',exact:true}).click();await expect(page.getByRole('heading',{name:'Add Result',exact:true})).toHaveCount(0)
  const goals=(await(await request.get(`${api}/api/goals/match/${match.id}`,{headers})).json()).data
  expect(goals.map(goal=>goal.player_id)).toEqual([scorer.id])
  await expect(page.locator('[class*="resultRow"]').locator('img')).toHaveCount(1)
  await page.getByRole('link',{name:'Standings',exact:true}).click();await expect(page.locator('[class*="tableRow"]').filter({has:page.getByText('Alpha FC',{exact:true})}).locator('img')).toHaveCount(1)
  await management(true);await page.getByRole('button',{name:'View Alpha FC roster',exact:true}).click()
  await page.getByRole('button',{name:'Rename Scorer original',exact:true}).click();await page.getByLabel('New player name',{exact:true}).fill('Corrected scorer');await page.getByRole('button',{name:'Save player',exact:true}).click();await expect(page.getByText('Corrected scorer',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Delete Corrected scorer',exact:true})).toBeDisabled()
  expect((await(await request.get(`${api}/api/goals/match/${match.id}`,{headers})).json()).data).toMatchObject([{id:goals[0].id,player_id:scorer.id,player_name:'Corrected scorer'}])
  await page.getByRole('button',{name:'Delete team',exact:true}).click();await page.getByRole('button',{name:'Confirm delete team',exact:true}).click();await expect(page.getByRole('alert')).toContainText('fixtures or recorded goals')
  await page.getByRole('button',{name:'Remove logo',exact:true}).click();await expect.poll(async()=>(await teams()).find(team=>team.id===alpha.id).logo_key).toBeNull();await expect(page.getByRole('region',{name:'Selected team'}).locator('img')).toHaveCount(0)
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'/tmp/pitchsync-roster-mobile.png'})
  await page.getByRole('link',{name:'Players',exact:true}).click();await expect(page.getByText('Corrected scorer',{exact:true})).toBeVisible()
})
