import type { Page } from '@playwright/test'
import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * J05: logging an expense takes three taps or fewer. From any trip screen
 * the FAB opens the quick expense with the keypad focused and the defaults
 * set; the person types the amount, may pick another category, and saves.
 * Taps are counted on everything but the keypad digits (the amount itself).
 * The offline variant proves the expense is queued, shown as pending, and
 * reaches the server exactly once. The service worker is blocked so the
 * journey proves the outbox, not the cache.
 */
test.use({ serviceWorkers: 'block' })

/** The UTC date `days` from now, `YYYY-MM-DD`: the trip is under way whenever the suite runs. */
function isoDay(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

/** Types an amount on the keypad (digits and the separator), the way a thumb does. */
async function typeAmount(page: Page, digits: string): Promise<void> {
  for (const key of digits) {
    await page.getByTestId(`ui.keypad.${key}`).click()
  }
}

test.describe('J05 quick expense in three taps', () => {
  // Both tests wipe the account's trips in beforeEach: run them one after the other.
  test.describe.configure({ mode: 'default' })

  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j05')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Lagoon loop',
        startsOn: isoDay(-1),
        endsOn: isoDay(5),
        baseCurrency: 'AUD',
      })
    } finally {
      await api.dispose()
    }
  })

  test('three taps from the FAB to a saved expense', async ({ page }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/money`)
    // The default categories have reached the device.
    await expect(page.getByTestId('money.budget.chart.bar')).toHaveCount(6)

    let taps = 0
    await page.getByTestId('shell.fab').click()
    taps += 1
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByTestId('money.quick.amount')).toBeVisible()
    // The keypad has the focus: the sheet opens ready to type.
    await expect(sheet.getByTestId('ui.keypad.1')).toBeFocused()
    await expect(sheet.getByTestId('money.quick.currency')).toHaveValue('AUD')
    await expect(
      sheet.locator('[data-testid="money.quick.category"].mk-chip--selected')
    ).toHaveCount(1)

    await typeAmount(page, '12.5')
    await expect(sheet.getByTestId('money.quick.amount')).toHaveText('$12.50')
    await sheet
      .locator('[data-testid="money.quick.category"][data-category-key="food"] button')
      .click()
    taps += 1
    await sheet.getByTestId('money.quick.save').click()
    taps += 1

    expect(taps).toBeLessThanOrEqual(3)
    await expect(page.getByTestId('ui.toast')).toContainText('Expense saved')
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/money$`))
    await expect(page.getByTestId('money.stat.spent')).toContainText('$12.50')

    await page.getByTestId('money.view.expenses').click()
    const row = page.getByTestId('money.expense')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Food')
    await expect(row).toContainText('add details')
    await expect(row).not.toContainText('pending', { timeout: 15_000 })
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })

  test('an expense saved offline shows as pending and syncs exactly once', async ({
    page,
    context,
  }) => {
    const pushes: { mutations: { entity: string; op: string }[] }[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/v1/sync/push')) {
        pushes.push(request.postDataJSON())
      }
    })
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/money`)
    await expect(page.getByTestId('money.budget.chart.bar')).toHaveCount(6)

    await context.setOffline(true)
    let taps = 0
    await page.getByTestId('shell.fab').click()
    taps += 1
    await typeAmount(page, '8')
    await page.getByRole('dialog').getByTestId('money.quick.save').click()
    taps += 1
    expect(taps).toBeLessThanOrEqual(3)
    await expect(page.getByTestId('ui.toast')).toContainText('will sync when online')

    await page.getByTestId('money.view.expenses').click()
    const row = page.getByTestId('money.expense')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('pending')
    expect(pushes).toHaveLength(0)

    await context.setOffline(false)
    await expect(row).not.toContainText('pending', { timeout: 15_000 })
    const sent = pushes
      .flatMap((push) => push.mutations)
      .filter((mutation) => mutation.entity === 'expense')
    expect(sent).toHaveLength(1)

    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      expect(snapshot.expenses).toHaveLength(1)
      expect(snapshot.expenses[0]).toMatchObject({
        amountMinor: 800,
        currency: 'AUD',
        baseAmountMinor: 800,
        needsDetails: true,
      })
    } finally {
      await api.dispose()
    }
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
