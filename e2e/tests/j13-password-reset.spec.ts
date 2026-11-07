import { soloAccount } from '../accounts.ts'
import { expect, test } from '../fixtures.ts'

/**
 * The test API (`MAIL_DRIVER=log`) exposes no way to read the mails it
 * would send, so the reset link itself cannot be followed here. The
 * journey covers both screens against the real API with the behaviour that
 * does not need the mail: the request is always accepted, and a link the
 * server does not know is expired. The functional suite of the API covers
 * the token itself.
 */
test.describe('J13 forgot and reset password', () => {
  test('asking for a reset link always confirms, whatever the address', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('auth.login.forgot').click()
    await expect(page).toHaveURL(/\/forgot-password$/)

    await page.getByTestId('auth.forgot.email').fill(soloAccount().email)
    await page.getByTestId('auth.forgot.submit').click()
    await expect(page.getByTestId('auth.forgot.sent')).toContainText(soloAccount().email)

    await page.goto('/forgot-password')
    await page.getByTestId('auth.forgot.email').fill('nobody-here@example.com')
    await page.getByTestId('auth.forgot.submit').click()
    await expect(page.getByTestId('auth.forgot.sent')).toContainText('nobody-here@example.com')
  })

  test('the reset screen needs the link and rejects a link the server does not know', async ({
    page,
  }) => {
    await page.goto('/reset-password')
    await expect(page.getByTestId('auth.reset.missingToken')).toBeVisible()

    await page.goto('/reset-password?token=not-a-real-token-0123456789abcdef')
    // The single-use token leaves the address bar (and the history) at once.
    await expect(page).toHaveURL(/\/reset-password$/)
    await page.getByTestId('auth.reset.password').fill('a brand new password')
    await page.getByTestId('auth.reset.submit').click()

    await expect(page.getByTestId('auth.reset.expired')).toContainText('no longer valid')
    await page.getByTestId('auth.reset.request').click()
    await expect(page).toHaveURL(/\/forgot-password$/)
  })
})
