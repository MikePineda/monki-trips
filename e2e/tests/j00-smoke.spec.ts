import { expect, test } from '../fixtures.ts'

test.describe('J00 smoke', () => {
  test('the app shell loads and an anonymous visitor is sent to sign in', async ({ page }) => {
    await page.goto('/trips')

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftrips$/)
    await expect(page.getByTestId('shell.name')).toHaveText('monki trips')
    await expect(page.getByTestId('auth.login.submit')).toBeVisible()
  })

  test('/api/health answers 200 JSON with version and sha', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    const body = await response.json()
    expect(body).toMatchObject({ status: 'ok', checks: { db: { status: 'ok' } } })
    expect(typeof body.version).toBe('string')
    expect(typeof body.sha).toBe('string')
  })

  test('the guard records a request to a public host', async ({ page, blockedRequests }) => {
    await page.goto('/login')
    await page.evaluate(() => fetch('https://example.com/').catch(() => undefined))

    expect(blockedRequests).toEqual(['https://example.com/'])
    // Expected here on purpose: empty the list so afterEach does not fail this test.
    blockedRequests.length = 0
  })
})
