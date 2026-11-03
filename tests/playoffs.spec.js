import {test,expect} from '@playwright/test'

test('playoff settings, qualification zones, progression and explicit result resolution work across portals',async({page,request,browser})=>{
  const api=process.env.PITCHSYNC_TEST_API_URL||'http://localhost:3000'
  const email=`playoffs-${Date.now()}-${Math.random().toString(16).slice(2,8)}@example.com`
  const account=await(await request.post(`${api}/api/auth/register`,{data:{email,password:'password123',leagueName:'Playoff browser verification'}})).json()
  const headers={Authorization:`Bearer ${account.token}`,'X-League-Id':String(account.league.id)}
  const teams=[];for(const name of ['Falcons FC','City Rovers','Kings FC','United SC','Athletic','Rangers'])teams.push((await(await request.post(`${api}/api/teams`,{headers,data:{name}})).json()).data)
  const originalFixtures=(await(await request.get(`${api}/api/fixtures/${account.league.id}`)).json()).data
  await page.goto('/login?tab=admin');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('password123');await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL('**/standings')
  await expect(page.locator('[data-qualification-zone=true]')).toHaveCount(0)
  await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('link',{name:/Competition Playoffs/}).click()
  await page.getByRole('button',{name:'Enable playoffs',exact:true}).click();await page.getByRole('button',{name:'Enabled',exact:true}).click()
  await page.getByRole('button',{name:'Third-place match',exact:true}).click();await page.getByRole('button',{name:'Include third-place match',exact:true}).click()
  await page.getByRole('button',{name:'Save playoff settings',exact:true}).click();await expect(page.getByRole('status')).toContainText('Playoff settings saved')
  await page.getByRole('link',{name:'Standings',exact:true}).click();await expect(page.locator('[data-qualification-zone=true]')).toHaveCount(4)
  await page.getByRole('link',{name:'View playoffs →',exact:true}).click();await expect(page.getByText('The bracket is not generated yet',{exact:true})).toBeVisible()
  await page.getByRole('link',{name:'Configure and preview playoffs →',exact:true}).click();await page.getByRole('button',{name:'Preview bracket',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Bracket preview',exact:true})).toBeVisible()
  await expect(page.getByText('Falcons FC',{exact:true})).toBeVisible();await expect(page.getByText('United SC',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Save playoff bracket',exact:true}).click();await page.waitForURL('**/playoffs')
  await expect(page.getByRole('article')).toHaveCount(4)
  async function open(label){await page.getByRole('article',{name:label,exact:true}).getByRole('button').click();return page.getByRole('dialog')}
  async function scores(dialog,home,away){await dialog.locator('input[type=number]').nth(0).fill(String(home));await dialog.locator('input[type=number]').nth(1).fill(String(away))}
  async function record(label,home,away,penalty){const dialog=await open(label);await scores(dialog,home,away);if(penalty){await dialog.getByRole('button',{name:'Penalty-shootout winner',exact:true}).click();await page.getByRole('button',{name:penalty,exact:true}).click()}await dialog.getByRole('button',{name:'Save playoff result',exact:true}).click();await expect(dialog).toHaveCount(0)}
  await record('Semifinal 1',2,0);await record('Semifinal 2',0,1)
  await record('Final',1,1,'Falcons FC');await record('Third-place match',2,0)
  await expect(page.getByRole('region',{name:'Playoff champion'})).toContainText('Falcons FC')
  await expect(page.getByText('Competition completed',{exact:true})).toBeVisible()
  await expect(page.getByRole('article',{name:'Final',exact:true})).toContainText('won on penalties')
  await page.getByRole('main').evaluate(node=>node.scrollTop=0);await page.screenshot({path:'/tmp/pitchsync-playoffs-desktop.png'})
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'/tmp/pitchsync-playoffs-mobile.png'})
  let dialog=await open('Semifinal 1');await scores(dialog,0,2);await dialog.getByRole('button',{name:'Save playoff result',exact:true}).click()
  await expect(dialog.getByRole('region',{name:'Resolve dependent results'})).toContainText('Third-place match')
  await expect(page.getByRole('region',{name:'Playoff champion'})).toContainText('Falcons FC')
  await dialog.getByRole('button',{name:'Clear 2 dependent results and save',exact:true}).click();await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('region',{name:'Playoff champion'})).toHaveCount(0)
  await expect(page.getByRole('article',{name:'Final',exact:true})).toContainText('United SC')
  await expect(page.getByRole('article',{name:'Final',exact:true}).getByRole('button',{name:'Record result'})).toBeVisible()
  dialog=await open('Semifinal 1');await dialog.getByRole('button',{name:'Clear result',exact:true}).click();await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('article',{name:'Final',exact:true})).toContainText('Awaiting teams')
  await page.getByRole('link',{name:'Playoff settings →',exact:true}).click();await page.getByRole('button',{name:'Enable playoffs',exact:true}).click();await page.getByRole('button',{name:'Disabled',exact:true}).click();await page.getByRole('button',{name:'Save playoff settings',exact:true}).click();await expect(page.getByRole('status')).toContainText('Playoff settings saved')
  await page.getByRole('link',{name:'View existing bracket →',exact:true}).click();await expect(page.getByText(/This saved bracket and its results remain available/)).toBeVisible()
  await page.getByRole('link',{name:'Standings',exact:true}).click();await expect(page.locator('[data-qualification-zone=true]')).toHaveCount(0)
  expect((await(await request.get(`${api}/api/fixtures/${account.league.id}`)).json()).data).toEqual(originalFixtures)
  const context=await browser.newContext();const player=await context.newPage()
  await player.goto(`${process.env.PITCHSYNC_TEST_BASE_URL||'http://localhost:5173'}/login`);await player.getByLabel('League Access Code',{exact:true}).fill(account.league.accessCode);await player.getByRole('button',{name:'Join League',exact:true}).click();await player.waitForURL('**/standings');await player.getByRole('link',{name:'Playoffs',exact:true}).click();await expect(player.getByRole('article')).toHaveCount(4);await expect(player.getByRole('button',{name:/Record result|Edit result/})).toHaveCount(0);await context.close()
})
