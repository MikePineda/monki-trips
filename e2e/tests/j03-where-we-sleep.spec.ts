import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * J03: "Where we sleep" raises the alert for every night without a place
 * to sleep; "Find a stay" opens the add-event sheet prefilled with lodging
 * for that night, and once the lodging covers the nights the alert is gone
 * here and in the trip summary.
 */
test.describe('J03 where we sleep', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j03')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Three nights',
        startsOn: '2027-03-01',
        endsOn: '2027-03-04',
        baseCurrency: 'EUR',
      })
    } finally {
      await api.dispose()
    }
  })

  test('an uncovered night shows the alert until lodging covers it', async ({ page }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/summary`)
    await expect(page.getByTestId('trip.summary.uncovered')).toContainText(
      '3 nights without a place to sleep'
    )

    await page.getByTestId('trip.summary.whereWeSleep').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/plan/nights$`))
    await expect(page.getByTestId('plan.view.nights')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('plan.nights.uncovered')).toContainText(
      '3 nights without a place to sleep'
    )
    await expect(page.getByTestId('plan.night')).toHaveCount(3)
    await expect(page.getByTestId('plan.night').first()).toContainText('No stay')
    await expect(page.getByTestId('plan.nights.counts')).toContainText('3 nights')

    await page.getByTestId('plan.night.findStay').first().click()
    const form = page.getByRole('dialog')
    await expect(form.getByTestId('events.form.kind')).toHaveValue('lodging')
    await expect(form.getByTestId('events.form.startDate')).toHaveValue('2027-03-01')
    await expect(form.getByTestId('events.form.startTime')).toHaveValue('15:00')
    await form.getByTestId('events.form.title').fill('Harbour Inn')
    await form.getByTestId('events.form.status').selectOption('booked')
    await form.getByTestId('events.form.endDate').fill('2027-03-04')
    await form.getByTestId('events.form.endTime').fill('11:00')
    await form.getByTestId('events.form.submit').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await expect(page.getByTestId('plan.nights.uncovered')).toHaveCount(0)
    await expect(page.getByTestId('plan.night.findStay')).toHaveCount(0)
    await expect(page.getByTestId('plan.night')).toHaveCount(3)
    for (const night of await page.getByTestId('plan.night').all()) {
      await expect(night).toContainText('Harbour Inn')
    }
    await expect(page.getByTestId('plan.nights.counts')).toContainText('3 in lodging')

    // The Days list spans the stay: check-in, a night in between, check-out.
    await page.getByTestId('plan.view.days').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/plan$`))
    const day = (date: string) => page.locator(`[data-testid="plan.day"][data-date="${date}"]`)
    await expect(day('2027-03-01')).toContainText('Check-in · Harbour Inn')
    await expect(day('2027-03-01')).toContainText('Night 1 of 3')
    await expect(day('2027-03-02')).toContainText('Night 2 of 3')
    await expect(day('2027-03-04')).toContainText('Check-out · Harbour Inn')

    await page.goto(`/t/${tripId}/summary`)
    await expect(page.getByTestId('trip.summary.stats')).toContainText('3 nights')
    await expect(page.getByTestId('trip.summary.uncovered')).toHaveCount(0)

    await expect(page.getByTestId('shell.connection')).toHaveCount(0, { timeout: 15_000 })
    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      expect(snapshot.events.map((event) => [event.kind, event.title])).toEqual([
        ['lodging', 'Harbour Inn'],
      ])
    } finally {
      await api.dispose()
    }
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
