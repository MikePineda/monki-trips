import { soloAccount, type E2eAccount } from '../accounts.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'
import { harbourToday, seedTodayTrip } from '../today-trip.ts'

/**
 * J07: the phone is prepared with "Download everything", then the app is
 * started again with no network at all, served by the real service
 * worker: Today shows the next event, the documents of the day (saved
 * offline) and tonight's stay, and the cold start is recorded as the
 * airplane-mode rehearsal.
 */
test.describe('J07 cold offline boot', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j07')
    ;({ tripId } = await seedTodayTrip(solo))
  })

  test('after download everything, Today opens with no network', async ({ page, context }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/more/offline`)
    await page.getByTestId('offline.download.action').click()
    await expect(page.getByTestId('offline.download.outcome')).toHaveText(
      'Everything is on this phone',
      { timeout: 60_000 }
    )
    await expect(page.getByTestId('offline.check.documents')).toContainText(
      '2 files saved and verified'
    )

    await page.goto(`/t/${tripId}/today`)
    await expect(page.getByTestId('today.day')).toHaveText('Day 1 of 5 · Port Vellmar')

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByTestId('today.day')).toHaveText('Day 1 of 5 · Port Vellmar')
    await expect(page.getByTestId('today.next')).toContainText('Harbour walk')
    await expect(page.getByTestId('ui.ticket.reference')).toHaveText('DEMO07')
    await expect(page.getByTestId('today.print')).toContainText('Walk voucher')
    const documents = page.getByTestId('today.document')
    await expect(documents).toHaveCount(2)
    await expect(documents.filter({ hasText: 'Entry pass' })).toContainText('Saved offline')
    await expect(page.getByTestId('today.tonight.name')).toHaveText('Lighthouse Rooms')
    await expect(page.getByTestId('today.tonight.address')).toHaveText('2 Beacon Road')
    await expect(page.getByTestId('shell.connection')).toHaveAttribute('data-state', 'offline')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    // The cold start without network is the rehearsal "Ready to fly" reports.
    await page.getByTestId('shell.tab.more').click()
    await page.getByTestId('trip.more.offline').click()
    await expect(page.getByTestId('offline.airplane.tested')).toContainText('Tested offline on')
  })
})

/**
 * J07 weather: on a trip that is under way, "Download everything" keeps
 * the forecast of the days ahead; with no network at all Today still shows
 * the cached weather of the day with its age and the data attribution.
 * The API runs the fake weather provider (e2e.env): no call leaves the
 * stack.
 */
test.describe('J07 cold offline boot keeps the weather', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j07w')
    ;({ tripId } = await seedTodayTrip(solo, { startsOn: harbourToday() }))
  })

  test('offline, Today still shows the cached weather of the day', async ({ page, context }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/more/offline`)
    await page.getByTestId('offline.download.action').click()
    await expect(page.getByTestId('offline.download.outcome')).toHaveText(
      'Everything is on this phone',
      { timeout: 60_000 }
    )

    await page.goto(`/t/${tripId}/today`)
    await expect(page.getByTestId('today.day')).toHaveText('Day 1 of 5 · Port Vellmar')
    await expect(page.getByTestId('today.weather.range')).toHaveText('24° / 16° · 40% rain')

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByTestId('shell.connection')).toHaveAttribute('data-state', 'offline')
    await expect(page.getByTestId('today.day')).toHaveText('Day 1 of 5 · Port Vellmar')
    await expect(page.getByTestId('today.weather.range')).toHaveText('24° / 16° · 40% rain')
    await expect(page.getByTestId('today.weather.age')).toContainText('Updated')
    await expect(page.getByTestId('today.weather.attribution')).toHaveText(
      'Weather data by monki-trips fake weather'
    )
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
