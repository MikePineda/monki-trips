import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * J05d: a trip with friends in split mode. The owner adds two travellers
 * without an account, switches the budget to split, logs a dinner paid
 * by themselves and split only with one of the friends, and the Balances
 * segment shows that friend owing half, with one transfer to settle. Mark
 * as settled records the settlement through the outbox and the API's
 * balances agree that everyone is even.
 */
test.use({ serviceWorkers: 'block' })

function isoDay(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

test.describe('J05d split trip with balances and settle up', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j05d')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Friends loop',
        startsOn: isoDay(-1),
        endsOn: isoDay(5),
        baseCurrency: 'AUD',
      })
    } finally {
      await api.dispose()
    }
  })

  test('a dinner split two ways shows who owes whom and settles to zero', async ({ page }) => {
    await signIn(page, solo)

    // Two friends without the app join the trip by name.
    await page.goto(`/t/${tripId}/more/members`)
    for (const name of ['Traveller B', 'Traveller C']) {
      await page.getByTestId('trip.members.addTraveller').click()
      const sheet = page.getByRole('dialog')
      await sheet.getByTestId('trip.members.travellerName').fill(name)
      await sheet.getByTestId('trip.members.travellerSave').click()
      await expect(sheet).toHaveCount(0)
    }
    await expect(page.getByTestId('trip.members.traveller')).toHaveCount(3)

    // Budget mode: split, with the explanation beside the choice.
    await page.goto(`/t/${tripId}/summary`)
    await page.getByTestId('trip.summary.edit').click()
    const edit = page.getByRole('dialog')
    await expect(edit).toContainText('Split: each expense records who paid')
    await edit.getByTestId('trip.edit.budgetMode').selectOption('split')
    await edit.getByTestId('trip.edit.submit').click()
    await expect(edit).toHaveCount(0)

    // The dinner: 90.00, paid by me, shared with Traveller C only.
    await page.goto(`/t/${tripId}/money`)
    await expect(page.getByTestId('money.view.balances')).toBeVisible()
    await page.getByTestId('shell.fab').click()
    const quick = page.getByRole('dialog')
    await quick.getByTestId('money.quick.currency').selectOption('AUD')
    for (const key of '90') {
      await quick.getByTestId(`ui.keypad.${key}`).click()
    }
    await expect(quick.getByTestId('money.quick.split')).toContainText('split 3 ways')
    await quick.getByTestId('money.quick.split').locator('button').click()
    const split = page.getByRole('dialog').filter({ has: page.getByTestId('money.split.done') })
    await split
      .locator('[data-testid="money.split.participant"]', { hasText: 'Traveller B' })
      .locator('button')
      .click()
    await expect(split.getByTestId('money.split.sum')).toContainText('90.00')
    await split.getByTestId('money.split.done').click()
    await expect(split).toHaveCount(0)
    await expect(quick.getByTestId('money.quick.split')).toContainText('split 2 ways')
    await quick
      .locator('[data-testid="money.quick.category"][data-category-key="food"] button')
      .click()
    await quick.getByTestId('money.quick.save').click()
    await expect(quick).toHaveCount(0)

    await page.getByTestId('money.view.expenses').click()
    await expect(page.getByTestId('money.expense')).toContainText('split 2 ways')
    await expect(page.getByTestId('money.expense')).not.toContainText('pending', {
      timeout: 15_000,
    })

    await page.getByTestId('money.view.balances').click()
    const balance = (name: string) => page.getByTestId('money.balance').filter({ hasText: name })
    await expect(balance('Traveller C')).toContainText('owes')
    await expect(balance('Traveller C')).toContainText('45.00')
    await expect(balance('Traveller B')).toContainText('settled')
    const settlements = page.getByTestId('money.settlement')
    await expect(settlements).toHaveCount(1)
    await expect(settlements).toContainText('Traveller C pays')
    await expect(settlements).toContainText('45.00')

    await page.getByTestId('money.settle.mark').click()
    await expect(page.getByTestId('money.balances.allSettled')).toBeVisible()
    await expect(balance('Traveller C')).toContainText('settled')

    // The server agrees once the settlement has synced.
    await expect
      .poll(
        async () => {
          const api = await ApiSession.signIn(solo)
          try {
            const view = await api.balances(tripId)
            return {
              settlements: view.settlements.length,
              nets: view.balances.map((row) => row.netMinor),
            }
          } finally {
            await api.dispose()
          }
        },
        { timeout: 15_000 }
      )
      .toEqual({ settlements: 0, nets: [0, 0, 0] })
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
