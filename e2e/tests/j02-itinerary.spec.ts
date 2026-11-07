import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * J02: a trip is planned from the phone: a stop in the summary, two events
 * in the Plan tab (one an overnight train), the day list with route chips,
 * the event detail with its "Directions" link, and an event added with no
 * connection that shows as pending and reaches the server exactly once.
 * The service worker is blocked so the journey proves the outbox.
 */
test.use({ serviceWorkers: 'block' })

test.describe('J02 itinerary', () => {
  // Both tests wipe the account's trips in beforeEach: run them one after the other.
  test.describe.configure({ mode: 'default' })

  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j02')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Harbour escape',
        startsOn: '2027-03-01',
        endsOn: '2027-03-05',
        baseCurrency: 'EUR',
      })
    } finally {
      await api.dispose()
    }
  })

  test('a stop, two events, the day list with chips and the event detail', async ({ page }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}`)
    // A trip that has not started opens on its summary.
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/summary$`))
    await expect(page.getByTestId('trip.summary.stats')).toContainText('5 days')

    await page.getByTestId('trip.summary.addStop').click()
    const stopSheet = page.getByRole('dialog')
    await stopSheet.getByTestId('trip.stop.name').fill('Port Vellmar')
    await stopSheet.getByTestId('trip.stop.country').fill('xa')
    await stopSheet.getByTestId('trip.stop.tz').selectOption('Asia/Bangkok')
    await stopSheet.getByTestId('trip.stop.arriveOn').fill('2027-03-01')
    await stopSheet.getByTestId('trip.stop.departOn').fill('2027-03-05')
    await stopSheet.getByTestId('trip.stop.submit').click()
    await expect(page.getByTestId('trip.summary.route')).toContainText('Port Vellmar')
    await expect(page.getByTestId('trip.summary.stop')).toHaveCount(1)

    await page.getByTestId('shell.tab.plan').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/plan$`))
    await expect(page.getByTestId('plan.day')).toHaveCount(5)
    await expect(page.getByTestId('plan.day.free')).toHaveCount(5)

    // A walk with an address, in the stop's zone (picked for the date).
    await page.getByTestId('plan.add').click()
    let form = page.getByRole('dialog')
    await form.getByTestId('events.form.kind').selectOption('tour')
    await form.getByTestId('events.form.title').fill('Harbour walk')
    await form.getByTestId('events.form.startDate').fill('2027-03-02')
    await form.getByTestId('events.form.startTime').fill('09:30')
    await expect(form.getByTestId('events.form.startTz')).toHaveValue('Asia/Bangkok')
    await form.getByTestId('events.form.address').fill('14 Quay Lane')
    await form.getByTestId('events.form.submit').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // An overnight train that lands the next morning.
    await page.getByTestId('plan.add').click()
    form = page.getByRole('dialog')
    await form.getByTestId('events.form.kind').selectOption('train')
    await form.getByTestId('events.form.title').fill('Night train to Aldermoor')
    await form.getByTestId('events.form.status').selectOption('booked')
    await form.getByTestId('events.form.startDate').fill('2027-03-03')
    await form.getByTestId('events.form.startTime').fill('20:30')
    await form.getByTestId('events.form.endDate').fill('2027-03-04')
    await form.getByTestId('events.form.endTime').fill('07:15')
    await form.getByTestId('events.form.bookingCode').fill('demo02')
    await form.getByTestId('events.form.submit').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const day = (date: string) => page.locator(`[data-testid="plan.day"][data-date="${date}"]`)
    await expect(day('2027-03-02')).toContainText('Harbour walk')
    await expect(day('2027-03-02')).toContainText('09:30')
    await expect(day('2027-03-02').getByTestId('plan.day.chips')).toContainText('Port Vellmar')
    await expect(day('2027-03-03')).toContainText('Night train to Aldermoor')
    await expect(day('2027-03-03')).toContainText('20:30')
    await expect(day('2027-03-04')).toContainText('Arrives · Night train to Aldermoor')
    await expect(day('2027-03-04')).toContainText('07:15')
    await expect(page.getByTestId('plan.day.free')).toHaveCount(2)
    await expect(day('2027-03-02').getByTestId('plan.event.directions')).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=14%20Quay%20Lane'
    )

    // The event detail is a sheet on its own URL.
    await day('2027-03-02').getByTestId('plan.event').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/plan/e/[0-9a-f-]{36}$`))
    const detail = page.getByRole('dialog')
    await expect(detail.getByTestId('events.detail.starts')).toContainText('Tue 2 Mar 09:30')
    await expect(detail.getByTestId('events.detail.address')).toContainText('14 Quay Lane')
    await expect(detail.getByTestId('events.detail.directions')).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=14%20Quay%20Lane'
    )
    await detail.getByTestId('ui.sheet.close').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/plan$`))

    // Everything reached the server once the outbox drained.
    await expect(page.getByTestId('shell.connection')).toHaveCount(0, { timeout: 15_000 })
    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      expect(snapshot.stops.map((stop) => stop.name)).toEqual(['Port Vellmar'])
      expect(snapshot.events.map((event) => [event.kind, event.title, event.startsOn])).toEqual(
        expect.arrayContaining([
          ['tour', 'Harbour walk', '2027-03-02'],
          ['train', 'Night train to Aldermoor', '2027-03-03'],
        ])
      )
      expect(snapshot.events).toHaveLength(2)
    } finally {
      await api.dispose()
    }
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })

  test('an event added offline shows as pending and syncs exactly once when back online', async ({
    page,
    context,
  }) => {
    const pushes: { mutations: { entity: string; changes: Record<string, unknown> }[] }[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/v1/sync/push')) {
        pushes.push(request.postDataJSON())
      }
    })
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/plan`)
    await expect(page.getByTestId('plan.day')).toHaveCount(5)

    await context.setOffline(true)
    await page.getByTestId('plan.add').click()
    const form = page.getByRole('dialog')
    await form.getByTestId('events.form.kind').selectOption('meal')
    await form.getByTestId('events.form.title').fill('Offline picnic')
    await form.getByTestId('events.form.startDate').fill('2027-03-05')
    await form.getByTestId('events.form.startTime').fill('12:00')
    await form.getByTestId('events.form.submit').click()

    const row = page.getByTestId('plan.event')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Offline picnic')
    await expect(row).toContainText('Pending')
    await expect(page.getByTestId('shell.connection')).toHaveAttribute('data-state', 'offline')
    expect(pushes).toHaveLength(0)

    await context.setOffline(false)
    await expect(row).not.toContainText('Pending', { timeout: 15_000 })
    await expect(row).toContainText('Offline picnic')

    const sent = pushes
      .flatMap((push) => push.mutations)
      .filter(
        (mutation) => mutation.entity === 'event' && mutation.changes['title'] === 'Offline picnic'
      )
    expect(sent).toHaveLength(1)
    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      expect(snapshot.events.filter((event) => event.title === 'Offline picnic')).toHaveLength(1)
    } finally {
      await api.dispose()
    }
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
