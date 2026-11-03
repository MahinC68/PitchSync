import { test, expect } from '@playwright/test'

test('league rules, manual adjustments and forfeits work together and stay isolated', async ({ page, request }) => {
  const api = process.env.PITCHSYNC_TEST_API_URL || 'http://localhost:3000'
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2,8)}`
  const email = `rules-${suffix}@example.com`
  const registered = await (await request.post(`${api}/api/auth/register`, { data: { email, password:'password123', leagueName:`Rules ${suffix}` } })).json()
  const first = registered.league
  const headers = { Authorization:`Bearer ${registered.token}`, 'X-League-Id':String(first.id) }
  const second = (await (await request.post(`${api}/api/leagues`, { headers, data:{ name:`Defaults ${suffix}` } })).json()).data
  const team = async name => (await (await request.post(`${api}/api/teams`, { headers, data:{name} })).json()).data
  const home = await team('Alpha FC'), away = await team('Beta FC')
  const createMatch = async () => (await (await request.post(`${api}/api/fixtures`, { headers, data:{home_team_id:home.id,away_team_id:away.id,date:'2026-11-10',time:'15:00'} })).json()).data
  const completed = await createMatch(), scheduled = await createMatch()
  await request.put(`${api}/api/fixtures/${completed.id}/result`, { headers, data:{home_score:2,away_score:0} })
  const player = (await (await request.post(`${api}/api/players`, { headers, data:{name:'Actual scorer',team_id:home.id} })).json()).data
  await request.post(`${api}/api/goals`, { headers, data:{match_id:completed.id,team_id:home.id,player_id:player.id} })
  const table = async () => (await (await request.get(`${api}/api/standings/${first.id}`)).json()).data

  await page.goto('/login?tab=admin')
  await page.getByLabel('Email', {exact:true}).fill(email)
  await page.getByLabel('Password', {exact:true}).fill('password123')
  await page.getByRole('button', {name:'Login',exact:true}).click()
  await page.waitForURL('**/standings')
  async function rulesPage() {
    await page.getByRole('link', {name:'Settings',exact:true}).click()
    await page.getByRole('link', {name:/League Rules/}).click()
    await expect(page.getByLabel('Win points', {exact:true})).toBeVisible()
  }
  await rulesPage()
  await expect(page.getByLabel('Win points', {exact:true})).toHaveValue('3')
  await page.getByLabel('Win points', {exact:true}).fill('5')
  await page.getByLabel('Draw points', {exact:true}).fill('2')
  await page.getByLabel('Loss points', {exact:true}).fill('-1')
  await page.getByRole('button', {name:'Match duration',exact:true}).click()
  await page.getByRole('button', {name:'Custom duration',exact:true}).click()
  await page.getByLabel('Custom minutes', {exact:true}).fill('75')
  await page.getByLabel('Winner goals', {exact:true}).fill('4')
  await page.getByLabel('Additional points deducted', {exact:true}).fill('2')
  for (let i=0;i<3;i++) await page.getByRole('button', {name:'Move Head-to-head record up',exact:true}).click()
  await page.getByRole('button', {name:'Save league rules',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('League rules saved')
  const saved = (await (await request.get(`${api}/api/rules`, {headers})).json()).data
  expect(saved).toMatchObject({win_points:5,draw_points:2,loss_points:-1,match_duration:75,forfeit_penalty:2})
  expect(saved.tiebreakers[0]).toBe('head_to_head')

  await page.getByRole('button', {name:'+ Add adjustment',exact:true}).click()
  await page.getByLabel('Points adjustment', {exact:true}).fill('-3')
  await page.getByLabel('Adjustment reason', {exact:true}).fill('Disciplinary deduction')
  await page.getByRole('button', {name:'Save adjustment',exact:true}).click()
  await expect(page.getByText('Disciplinary deduction', {exact:true})).toBeVisible()
  await page.getByRole('button', {name:'Edit',exact:true}).click()
  await page.getByLabel('Points adjustment', {exact:true}).fill('-1')
  await page.getByLabel('Adjustment reason', {exact:true}).fill('Corrected deduction')
  await page.getByRole('button', {name:'Save adjustment',exact:true}).click()
  await expect(page.getByText('Corrected deduction', {exact:true})).toBeVisible()
  expect((await table()).find(team=>team.teamId===home.id)).toMatchObject({pts:4,basePts:5,manualAdjustment:-1,recentPoints:5})
  await page.getByRole('link', {name:'Standings',exact:true}).click()
  await expect(page.getByText('5 pts · last 1 matches', {exact:true})).toBeVisible()
  await expect(page.getByText('-1 adj.', {exact:true}).first()).toBeVisible()
  await rulesPage()
  await expect(page.getByLabel('Custom minutes', {exact:true})).toHaveValue('75')
  await page.getByRole('button', {name:'Delete',exact:true}).click()
  await page.getByRole('button', {name:'Confirm remove',exact:true}).click()
  await expect(page.getByText('No manual points adjustments.', {exact:true})).toBeVisible()
  expect((await table()).find(team=>team.teamId===home.id).pts).toBe(5)

  await page.getByRole('link', {name:'Schedule',exact:true}).click()
  await page.locator('[class*="resultRow"]').getByRole('button', {name:'Forfeit',exact:true}).click()
  const forfeit = page.getByRole('dialog', {name:'Record forfeit',exact:true})
  await forfeit.getByRole('button', {name:'Forfeiting team',exact:true}).click()
  await page.getByRole('button', {name:'Beta FC',exact:true}).click()
  await expect(forfeit.getByText('4 – 0', {exact:true})).toBeVisible()
  await forfeit.getByRole('button', {name:'Record forfeit',exact:true}).click()
  await expect(page.getByRole('button', {name:'View forfeit',exact:true})).toBeVisible()
  expect((await table()).find(team=>team.teamId===away.id)).toMatchObject({pts:-3,forfeitPenalty:2})
  expect((await (await request.get(`${api}/api/players/${first.id}/top-scorers`)).json()).data[0].goals).toBe(0)
  await page.getByRole('button', {name:'View forfeit',exact:true}).click()
  await page.getByRole('button', {name:'Clear forfeit',exact:true}).click()
  await expect(page.locator('[class*="score"]').getByText('2 – 0', {exact:true})).toBeVisible()
  expect((await (await request.get(`${api}/api/players/${first.id}/top-scorers`)).json()).data[0].goals).toBe(1)

  await page.locator('[class*="fixtureRow"]').getByRole('button', {name:'Forfeit',exact:true}).click()
  await page.getByRole('button', {name:'Forfeiting team',exact:true}).click()
  await page.getByRole('button', {name:'Alpha FC',exact:true}).click()
  await page.getByRole('dialog', {name:'Record forfeit',exact:true}).getByRole('button', {name:'Record forfeit',exact:true}).click()
  await expect(page.getByText('No upcoming fixtures.', {exact:true})).toBeVisible()
  expect((await table()).find(team=>team.teamId===home.id)).toMatchObject({pts:2,basePts:4,forfeitPenalty:2})
  await page.getByRole('button', {name:'View forfeit',exact:true}).click()
  await page.getByRole('button', {name:'Clear forfeit',exact:true}).click()
  await expect(page.locator('[class*="fixtureRow"]').getByRole('button', {name:'Forfeit',exact:true})).toBeVisible()
  expect((await table()).find(team=>team.teamId===home.id).pts).toBe(5)

  await rulesPage()
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  await page.screenshot({path:'/tmp/pitchsync-rules-mobile.png'})
  await page.getByRole('button', {name:'Switch league',exact:true}).click()
  await page.getByRole('dialog', {name:'Switch league picker',exact:true}).getByRole('button', {name:second.name,exact:true}).click()
  await expect(page.getByLabel('Win points', {exact:true})).toHaveValue('3')
  await expect(page.getByRole('button', {name:'+ Add adjustment',exact:true})).toBeDisabled()
})
