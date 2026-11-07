import { soloAccount, type E2eAccount } from '../accounts.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'
import { seedTodayTrip } from '../today-trip.ts'

/** J08: Today follows a switch to Spanish and back without a raw key on screen. */
test.use({ serviceWorkers: 'block' })

test.describe('J08 language switch on Today', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j08')
    ;({ tripId } = await seedTodayTrip(solo))
  })

  test('Today reads in Spanish after the switch, and in English again', async ({ page }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/today`)
    await expect(page.getByTestId('today.day')).toHaveText('Day 1 of 5 · Port Vellmar')
    await expect(page.getByTestId('today.print')).toContainText('Bring this printed')

    await page.getByTestId('shell.tab.more').click()
    await page.getByTestId('trip.more.settings').click()
    await page.getByTestId('settings.lang.es').click()
    await page.getByTestId('shell.tab.today').click()

    await expect(page.getByTestId('today.day')).toHaveText('Día 1 de 5 · Port Vellmar')
    await expect(page.getByTestId('today.preview')).toContainText('Vista previa del día 1')
    await expect(page.getByTestId('today.print')).toContainText('Llévalo impreso')
    await expect(page.getByTestId('today.tonight')).toContainText('Esta noche')
    await expect(page.getByTestId('shell.fab')).toContainText('Añadir gasto')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    await page.getByTestId('shell.tab.more').click()
    await page.getByTestId('trip.more.settings').click()
    await page.getByTestId('settings.lang.en').click()
    await page.getByTestId('shell.tab.today').click()
    await expect(page.getByTestId('today.day')).toHaveText('Day 1 of 5 · Port Vellmar')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
