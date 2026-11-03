import { test, expect } from '@playwright/test'

// Creates a disposable account. Run against the isolated API/database described in README.
test('one admin creates, renames, and switches leagues without mixing data', async ({ page, request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const first = `League A ${suffix}`
  const second = `League B ${suffix}`
  const renamed = `Renamed B ${suffix}`
  await page.goto('/register')
  await page.getByLabel('Email', { exact: true }).fill(`multileague-${suffix}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByLabel('League Name', { exact: true }).fill(first)
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  await page.waitForURL('**/standings')
  const switcher = page.getByRole('button', { name: 'Switch league', exact: true })
  await expect(switcher).toContainText(first)
  const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('pitchsync')))
  const initial = await session()

  async function addTeam(name) {
    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await page.getByRole('link', { name: /Teams & Players/ }).click()
    await page.getByPlaceholder('Team name', { exact: true }).fill(name)
    await page.getByRole('button', { name: '+ Add Team', exact: true }).click()
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  }
  async function switchTo(name) {
    await switcher.click()
    await page.getByRole('dialog', { name: 'Switch league picker', exact: true }).getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click()
    await expect(switcher).toContainText(name)
    await expect(page.getByText('Switching league…', { exact: true })).toHaveCount(0)
  }
  await addTeam('A team only')
  await switcher.click()
  await page.getByRole('button', { name: '+ Create league', exact: true }).click()
  await page.getByRole('dialog', { name: 'Create league', exact: true }).getByLabel('League name', { exact: true }).fill(second)
  await page.getByRole('dialog', { name: 'Create league', exact: true }).getByRole('button', { name: 'Create league', exact: true }).click()
  await expect(switcher).toContainText(second)
  await expect(page.getByText('A team only', { exact: true })).toHaveCount(0)
  await addTeam('B team only')
  const secondSession = await session()
  expect(secondSession.token).toBe(initial.token)
  expect(secondSession.leagueId).not.toBe(initial.leagueId)

  // Create a fixture/result in B, verifying that the same account token scopes every write.
  const api = process.env.PITCHSYNC_TEST_API_URL || 'http://localhost:3000'
  const headers = { Authorization: `Bearer ${initial.token}`, 'X-League-Id': String(secondSession.leagueId) }
  const teams = await (await request.get(`${api}/api/teams`, { headers })).json()
  const other = await (await request.post(`${api}/api/teams`, { headers, data: { name: 'B opponent' } })).json()
  const fixture = await (await request.post(`${api}/api/fixtures`, { headers, data: { home_team_id: teams.data[0].id, away_team_id: other.data.id, date: '2026-11-10', time: '15:00' } })).json()
  expect(fixture.data.id).toBeTruthy()
  const result = await request.put(`${api}/api/fixtures/${fixture.data.id}/result`, { headers, data: { home_score: 2, away_score: 0 } })
  expect(result.ok()).toBeTruthy()
  await page.getByRole('link', { name: 'Standings', exact: true }).click()
  await expect(page.getByText('B team only', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('A team only', { exact: true })).toHaveCount(0)

  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('region', { name: 'General settings' })).toBeVisible()
  const codes = await (await request.get(`${api}/api/leagues`, { headers })).json()
  expect(codes.data).toHaveLength(2)
  expect(new Set(codes.data.map(league => league.access_code)).size).toBe(2)
  const playerCode = codes.data.find(league => league.id === secondSession.leagueId).access_code
  await page.getByRole('button', { name: 'Rename league', exact: true }).click()
  await page.getByRole('dialog', { name: 'Rename league', exact: true }).getByLabel('League name', { exact: true }).fill(renamed)
  await page.getByRole('dialog', { name: 'Rename league', exact: true }).getByRole('button', { name: 'Rename league', exact: true }).click()
  await expect(switcher).toContainText(renamed)
  await page.reload()
  await expect(switcher).toContainText(renamed)
  await switchTo(first)
  await page.getByRole('link', { name: 'Teams & Players', exact: false }).click()
  await expect(page.getByText('A team only', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('B team only', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Schedule', exact: true }).click()
  await expect(page.getByText('No results yet.', { exact: true })).toBeVisible()

  // Switching closes an old league's open dialog and resets its page data.
  await page.getByRole('button', { name: '+ Add Fixture', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add Fixture', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('heading', { name: 'Add Fixture', exact: true }).waitFor({ state: 'detached' })
  await switchTo(renamed)
  await expect(page.getByText('B team only', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('A team only', { exact: true })).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await switchTo(first)
  await expect(switcher).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await page.goto('/login?tab=player')
  await page.getByLabel('League Access Code', { exact: true }).fill(playerCode)
  await page.getByRole('button', { name: 'Join League', exact: true }).click()
  await page.waitForURL('**/standings')
  await expect(page.getByText('B team only', { exact: true }).first()).toBeVisible()
  await expect(switcher).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0)
})

test('late responses and cross-tab switching cannot carry old-league UI into the active league', async ({ page, request }) => {
  const api = process.env.PITCHSYNC_TEST_API_URL || 'http://localhost:3000'
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const registered = await (await request.post(`${api}/api/auth/register`, { data: { email: `late-${suffix}@example.com`, password: 'password123', leagueName: `First ${suffix}` } })).json()
  const token = registered.token
  const first = registered.league
  const second = (await (await request.post(`${api}/api/leagues`, { headers: { Authorization: `Bearer ${token}` }, data: { name: `Second ${suffix}` } })).json()).data
  await request.post(`${api}/api/teams`, { headers: { Authorization: `Bearer ${token}`, 'X-League-Id': String(first.id) }, data: { name: 'Old response team' } })
  await request.post(`${api}/api/teams`, { headers: { Authorization: `Bearer ${token}`, 'X-League-Id': String(second.id) }, data: { name: 'Active league team' } })
  await page.goto('/')
  await page.evaluate(({ token, first }) => localStorage.setItem('pitchsync', JSON.stringify({ role: 'admin', token, LeagueId: first.id, LeagueName: first.name })), { token, first })
  await page.goto('/standings')
  await page.getByText('Old response team', { exact: true }).first().waitFor()
  let release, arrived
  const received = new Promise(resolve => { arrived = resolve })
  const held = new Promise(resolve => { release = resolve })
  await page.route('**/api/teams', async route => {
    if (route.request().headers()['x-league-id'] === String(first.id)) {
      const response = await route.fetch()
      arrived()
      await held
      await route.fulfill({ response })
    } else await route.continue()
  })
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('link', { name: /Teams & Players/ }).click()
  await received
  await page.getByRole('button', { name: 'Switch league', exact: true }).click()
  await page.getByRole('dialog', { name: 'Switch league picker', exact: true }).getByRole('button', { name: second.name, exact: true }).click()
  await expect(page.getByText('Active league team', { exact: true }).first()).toBeVisible()
  release()
  await expect(page.getByText('Old response team', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Schedule', exact: true }).click()
  await page.getByRole('button', { name: '+ Add Fixture', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add Fixture', exact: true })).toBeVisible()
  await page.evaluate(first => {
    const session = JSON.parse(localStorage.getItem('pitchsync'))
    localStorage.setItem('pitchsync', JSON.stringify({ ...session, leagueId: first.id, leagueName: first.name, LeagueId: first.id, LeagueName: first.name }))
    window.dispatchEvent(new Event('storage'))
  }, first)
  await expect(page.getByRole('heading', { name: 'Add Fixture', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Switch league', exact: true })).toContainText(first.name)
  await page.getByRole('link', { name: 'Standings', exact: true }).click()
  await expect(page.getByText('Old response team', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Active league team', { exact: true })).toHaveCount(0)
})
