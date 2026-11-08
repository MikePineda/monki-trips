import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { isoDay } from '../narrow-trip.ts'
import { signIn } from '../sign-in.ts'

/**
 * J20: the recap of a trip we are back from. A ten-day split trip through
 * two invented countries with three expenses and one settlement: the
 * past ticket opens the recap, Kiko celebrates, the numbers come from the
 * device (settlements left out), the page reloads with no network at all
 * from the service worker and the device copy, and the expenses download
 * as Trip expenses CSV v1 while online, the settlement marked.
 *
 * With E2E_SCREENSHOTS=1 it also writes the recap at 390 × 844, light and
 * dark, to e2e/screenshots/recap/.
 */
const SCREENSHOTS = fileURLToPath(new URL('../screenshots/recap/', import.meta.url))
const TILES = /^https:\/\/tiles\.openfreemap\.org\//

test.describe('J20 trip recap', () => {
  test.describe.configure({ mode: 'default' })

  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({ page }, testInfo) => {
    await page.route(TILES, (route) => route.abort('internetdisconnected'))
    solo = soloAccount(testInfo.project.name, 'j20')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Two-country loop',
        startsOn: isoDay(-12),
        endsOn: isoDay(-3),
        baseCurrency: 'EUR',
      })
      const friend = randomUUID()
      await api.push(tripId, [
        { entity: 'traveller', id: friend, changes: { displayName: 'Traveller B', position: 1 } },
        { entity: 'trip', id: tripId, changes: { budgetTotalMinor: 100_000, budgetMode: 'split' } },
        {
          entity: 'stop',
          id: randomUUID(),
          changes: {
            position: 0,
            name: 'Harbour City',
            countryCode: 'XA',
            lat: 12.5,
            lng: 10.25,
            tz: 'UTC',
            arriveOn: isoDay(-12),
            departOn: isoDay(-8),
          },
        },
        {
          entity: 'stop',
          id: randomUUID(),
          changes: {
            position: 1,
            name: 'Old Town',
            countryCode: 'XB',
            lat: 14.75,
            lng: 16.5,
            tz: 'UTC',
            arriveOn: isoDay(-8),
            departOn: isoDay(-3),
          },
        },
      ])
      const snapshot = await api.snapshot(tripId)
      const category = (key: string) => snapshot.budgetCategories.find((row) => row.key === key)!.id
      const owner = snapshot.travellers.find((row) => row.userId !== null)!.id
      await api.push(tripId, [
        {
          entity: 'expense',
          id: randomUUID(),
          changes: {
            amountMinor: 40_000,
            currency: 'EUR',
            spentOn: isoDay(-12),
            description: 'Guesthouse',
            categoryId: category('accommodation'),
          },
        },
        {
          entity: 'expense',
          id: randomUUID(),
          changes: {
            amountMinor: 6_000,
            currency: 'EUR',
            spentOn: isoDay(-9),
            description: '=Harbour dinner',
            categoryId: category('food'),
          },
        },
        {
          entity: 'expense',
          id: randomUUID(),
          changes: {
            kind: 'settlement',
            amountMinor: 3_000,
            currency: 'EUR',
            spentOn: isoDay(-4),
            description: 'Settle up',
            categoryId: category('other'),
            paidByTravellerId: friend,
            shares: [{ id: randomUUID(), travellerId: owner, shareMinor: 3_000 }],
          },
        },
      ])
    } finally {
      await api.dispose()
    }
  })

  test('a past trip: recap numbers, an offline reload and the expenses CSV', async ({
    page,
    context,
  }) => {
    await signIn(page, solo)

    // The ticket of a trip we are back from opens its recap.
    const past = page.getByTestId('history.past')
    await past.getByTestId('trips.item').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/recap$`))
    await expect(page.getByTestId('recap.title')).toHaveText('Trip recap')
    await expect(page.getByTestId('recap.mascot')).toHaveAttribute('data-state', 'celebrating')

    const tile = (id: string) => page.getByTestId(`recap.stat.${id}`).locator('.mk-stat__value')
    await expect(tile('days')).toHaveText('10')
    await expect(tile('nights')).toHaveText('9')
    await expect(tile('countries')).toHaveText('2')
    await expect(tile('distance')).toHaveText(/^\d[\d,]* km$/)
    // The settlement moves money between travellers: it is not spending.
    await expect(tile('spent')).toHaveText('€460.00')
    await expect(tile('perDay')).toHaveText('€46.00')
    await expect(page.getByTestId('recap.settlements')).toBeVisible()
    await expect(page.getByTestId('recap.money.chart.bar')).toHaveCount(2)
    await expect(page.getByTestId('recap.stamp')).toHaveCount(4)
    await expect(page.getByTestId('recap.balance')).toHaveCount(2)

    // The expenses as Trip expenses CSV v1, the settlement marked.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('recap.exportCsv').click(),
    ])
    expect(download.suggestedFilename()).toMatch(
      /^trip-two-country-loop-expenses-\d{4}-\d{2}-\d{2}\.csv$/
    )
    const csv = readFileSync((await download.path())!, 'utf8')
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    expect(lines[0]).toBe(
      'date,description,category,amount,currency,base_amount,base_currency,fx_rate,paid_by,split_with,kind,trip'
    )
    expect(lines.slice(1, -1)).toHaveLength(3)
    expect(lines.find((line) => line.includes('Guesthouse'))).toContain(',400.00,EUR,400.00,EUR,1,')
    expect(lines.find((line) => line.includes('Harbour dinner'))).toContain("'=Harbour dinner")
    expect(lines.find((line) => line.includes('Settle up'))).toMatch(
      /,settlement,Two-country loop$/
    )

    // With no network at all the recap reloads from the service worker and the device copy.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await context.setOffline(true)
    await page.reload()
    await expect(tile('days')).toHaveText('10', { timeout: 15_000 })
    await expect(tile('spent')).toHaveText('€460.00')
    await expect(page.getByTestId('recap.exportCsv')).toHaveCount(0)
    await expect(page.getByTestId('recap.csvOffline')).toBeVisible()
    await expect(page.getByTestId('recap.map')).toHaveAttribute('data-mode', 'fallback')
    await context.setOffline(false)
  })

  test('screenshots of the recap at 390 × 844, light and dark', async ({ page }) => {
    test.skip(!process.env.E2E_SCREENSHOTS, 'set E2E_SCREENSHOTS=1 to refresh them')
    mkdirSync(SCREENSHOTS, { recursive: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, solo)
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      await page.goto(`/t/${tripId}/recap`)
      await expect(page.getByTestId('recap.stamp')).toHaveCount(4)
      await expect(page.getByTestId('recap.map')).toHaveAttribute('data-mode', 'fallback')
      await page.screenshot({ path: `${SCREENSHOTS}recap-390-${scheme}.png` })
      await page.screenshot({ path: `${SCREENSHOTS}recap-390-${scheme}-full.png`, fullPage: true })
    }
  })
})
