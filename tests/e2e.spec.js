import { test, expect } from '@playwright/test'

const PLAYER_CODE = 'METRO2025'
const ADMIN_EMAIL = 'test@pitchsync.com'
const ADMIN_PASS  = 'password123'

// Shared helper: log in as player via direct URL (skips home page)
async function loginAsPlayer(page) {
  await page.goto('/login?tab=player')
  await page.fill('#accessCode', PLAYER_CODE)
  await page.getByRole('button', { name: 'Join League' }).click()
  await page.waitForURL('**/standings')
  await page.waitForLoadState('networkidle')
}

test.describe('PitchSync critical flows', () => {

  test('1 – player access flow', async ({ page }) => {
    // Visit homepage
    await page.goto('/')

    // Click "Player" link in the hero
    await page.getByRole('link', { name: 'Player' }).click()
    await expect(page).toHaveURL(/\/login/)

    // Enter access code and submit
    await page.fill('#accessCode', PLAYER_CODE)
    await page.getByRole('button', { name: 'Join League' }).click()

    // Verify redirect to /standings
    await page.waitForURL('**/standings')
    await page.waitForLoadState('networkidle')

    // Verify standings table has at least one data row
    const dataRows = page.locator('[class*="tableRow"]:not([class*="tableHead"])')
    await expect(dataRows.first()).toBeVisible()
  })

  test('2 – admin login flow', async ({ page }) => {
    // Visit homepage
    await page.goto('/')

    // Click "Admin" link in the hero
    await page.getByRole('link', { name: 'Admin' }).click()
    await expect(page).toHaveURL(/\/login/)

    // Enter credentials and submit
    await page.fill('#email', ADMIN_EMAIL)
    await page.fill('#password', ADMIN_PASS)
    await page.getByRole('button', { name: 'Login' }).click()

    // Verify redirect to /standings
    await page.waitForURL('**/standings')
    await page.waitForLoadState('networkidle')

    // Verify "+ Add Result" button is visible (admin-only)
    await expect(page.getByRole('button', { name: /add result/i })).toBeVisible()

    // Verify "Settings" nav link is visible in sidebar
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
  })

  test('3 – standings data flow', async ({ page }) => {
    await loginAsPlayer(page)
    // Already on /standings after login

    // Verify all column headers are present
    const header = page.locator('[class*="tableHead"]')
    await expect(header).toBeVisible()
    for (const col of ['#', 'Team', 'MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'PTS', 'Form']) {
      await expect(header.getByText(col, { exact: true })).toBeVisible()
    }

    // Verify at least 4 teams are shown
    const dataRows = page.locator('[class*="tableRow"]:not([class*="tableHead"])')
    const count = await dataRows.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('4 – schedule data flow', async ({ page }) => {
    await loginAsPlayer(page)

    // Navigate to schedule via sidebar
    await page.getByRole('link', { name: 'Schedule' }).click()
    await page.waitForURL('**/schedule')
    await page.waitForLoadState('networkidle')

    // Verify "Past Results" section heading exists
    await expect(page.getByText(/past results/i).first()).toBeVisible()

    // Verify at least one past result row is shown
    const resultRows = page.locator('[class*="resultRow"]')
    await expect(resultRows.first()).toBeVisible()
  })

  test('5 – leaderboard data flow', async ({ page }) => {
    await loginAsPlayer(page)

    // Navigate to players/leaderboard via sidebar
    await page.getByRole('link', { name: 'Players' }).click()
    await page.waitForURL('**/players')
    await page.waitForLoadState('networkidle')

    // Verify all column headers are present
    const header = page.locator('[class*="header"]').first()
    await expect(header).toBeVisible()
    for (const col of ['Rank', 'Player', 'Team', 'Goals']) {
      await expect(page.getByText(col, { exact: true }).first()).toBeVisible()
    }

    // Verify at least one player row is shown
    const playerRows = page.locator('[class*="row"]:not([class*="header"])')
    await expect(playerRows.first()).toBeVisible()
  })

})
