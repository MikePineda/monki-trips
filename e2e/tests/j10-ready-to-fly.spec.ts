import { soloAccount, type E2eAccount } from '../accounts.ts'
import { grantDurableStorage } from '../durable-storage.ts'
import { expect, test } from '../fixtures.ts'
import { emulateInstalledIphoneApp } from '../installed-iphone-app.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'
import { seedTodayTrip } from '../today-trip.ts'

/**
 * J10: "Ready to fly" is red on a phone that has not downloaded the trip
 * (documents missing) and all green once "Download everything" has run.
 */
test.describe('J10 ready to fly', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j10')
    ;({ tripId } = await seedTodayTrip(solo))
  })

  test('red before download everything, all green after', async ({
    page,
    browser,
    baseURL,
    browserName,
  }) => {
    // What an installed app gets on a phone; a fresh headless profile does not.
    // On iOS the check also requires the installed app (Safari keeps separate data).
    const iphone = browserName === 'webkit'
    if (iphone) {
      await emulateInstalledIphoneApp(page)
    } else {
      await grantDurableStorage(browser, page, new URL(baseURL ?? '').origin)
    }
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/more/offline`)

    const summary = page.getByTestId('offline.ready.summary')
    await expect(summary).toHaveAttribute('data-ready', 'false')
    await expect(page.getByTestId('offline.check.documents')).toContainText(
      '2 files are missing or out of date'
    )
    await expect(page.getByTestId('offline.fix.documents')).toBeVisible()

    await page.getByTestId('offline.download.action').click()
    await expect(page.getByTestId('offline.download.outcome')).toHaveText(
      'Everything is on this phone',
      { timeout: 60_000 }
    )

    await expect(summary).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
    await expect(summary).toHaveText('This phone is ready to fly')
    await expect(page.locator('[data-testid^="offline.fix."]')).toHaveCount(0)
    await expect(page.getByTestId('offline.check.installed')).toContainText(
      iphone ? 'Running as the installed app' : 'Not needed on this device'
    )
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
