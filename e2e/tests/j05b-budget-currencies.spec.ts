import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * J05b: two expenses in different currencies (the base AUD and THB) land
 * in the budget converted at the rate the API attaches on sync (the fake
 * FX provider of the test environment: 22.5 THB per AUD), and the bars
 * and their table view show the same totals. The base dollar is written
 * `A$` once the trip mixes currencies.
 */
test.use({ serviceWorkers: 'block' })

function isoDay(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

test.describe('J05b budget bars and table in two currencies', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j05b')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Two-currency loop',
        startsOn: isoDay(-1),
        endsOn: isoDay(5),
        baseCurrency: 'AUD',
      })
    } finally {
      await api.dispose()
    }
  })

  test('bars and table view show the same totals after expenses in AUD and THB', async ({
    page,
  }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/money`)
    await expect(page.getByTestId('money.budget.chart.bar')).toHaveCount(6)

    const add = async (currency: string, digits: string, categoryKey: string) => {
      await page.getByTestId('shell.fab').click()
      const sheet = page.getByRole('dialog')
      await sheet.getByTestId('money.quick.currency').selectOption(currency)
      for (const key of digits) {
        await sheet.getByTestId(`ui.keypad.${key}`).click()
      }
      await sheet
        .locator(`[data-testid="money.quick.category"][data-category-key="${categoryKey}"] button`)
        .click()
      await sheet.getByTestId('money.quick.save').click()
      await expect(sheet).toHaveCount(0)
    }
    await add('AUD', '12.5', 'food')
    await add('THB', '450', 'transport')

    // Synced and converted: nothing pending, nothing waiting for a rate.
    await page.getByTestId('money.view.expenses').click()
    await expect(page.getByTestId('money.expense')).toHaveCount(2)
    await expect(page.getByTestId('money.expenses.empty')).toHaveCount(0)
    for (const row of await page.getByTestId('money.expense').all()) {
      await expect(row).not.toContainText(/pending|waiting for rate/, { timeout: 15_000 })
    }
    await expect(page.getByTestId('money.expense').filter({ hasText: '฿450.00' })).toContainText(
      'A$20.00'
    )

    await page.getByTestId('money.view.budget').click()
    await expect(page.getByTestId('money.stat.spent')).toContainText('A$32.50')
    const bars = page.getByTestId('money.budget.chart.bar')
    await expect(bars.filter({ hasText: 'Food' })).toContainText('A$12.50')
    await expect(bars.filter({ hasText: 'Transport' })).toContainText('A$20.00')
    const fromBars = await bars.evaluateAll((elements) =>
      elements.map((bar) => [
        bar.querySelector('[data-testid="ui.barChart.label"]')?.textContent?.trim(),
        bar.querySelector('[data-testid="ui.barChart.value"]')?.textContent?.trim(),
      ])
    )

    await page.getByTestId('money.budget.view.table').click()
    const rows = page.getByTestId('money.budget.table.row')
    await expect(rows).toHaveCount(6)
    const fromTable = await rows.evaluateAll((elements) =>
      elements.map((row) => [
        row.querySelector('[data-column="category"]')?.textContent?.trim(),
        row.querySelector('[data-column="spent"]')?.textContent?.trim(),
      ])
    )
    expect(fromTable).toEqual(fromBars)

    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      const thb = snapshot.expenses.find((expense) => expense.currency === 'THB')
      expect(thb).toMatchObject({ amountMinor: 45000, fxRate: '22.5', baseAmountMinor: 2000 })
    } finally {
      await api.dispose()
    }
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
