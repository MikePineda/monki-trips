import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { isoDay } from '../narrow-trip.ts'
import { signIn } from '../sign-in.ts'

/**
 * J17: the travel history, the passport and the map. A past trip through
 * two invented countries (Xaloa, with drawn artwork, and Xebria) is in the
 * history's "where we have been", Kiko celebrates its new stamps, and the
 * passport shows one page and one country stamp per country with their
 * city stamps. With the connection gone, the map of where we have been is
 * the SVG world view with the cities as dots. The tile provider is never
 * reached: the journey aborts it, so the run is the same on a laptop, in
 * CI and in a VM with no route out.
 *
 * With E2E_SCREENSHOTS=1 it also writes the passport at 390 × 844, light
 * and dark, and the sheet of twelve generated stamps from the styleguide
 * to e2e/screenshots/passport/.
 */
test.use({ serviceWorkers: 'block' })

const SCREENSHOTS = fileURLToPath(new URL('../screenshots/passport/', import.meta.url))
const TILES = /^https:\/\/tiles\.openfreemap\.org\//

test.describe('J17 history, passport and map', () => {
  // Both tests wipe the account's trips in beforeEach: run them one after the other.
  test.describe.configure({ mode: 'default' })

  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({ page }, testInfo) => {
    await page.route(TILES, (route) => route.abort('internetdisconnected'))
    solo = soloAccount(testInfo.project.name, 'j17')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      // Back three days ago: Kiko still celebrates.
      tripId = await api.createTrip({
        name: 'Two-country loop',
        startsOn: isoDay(-12),
        endsOn: isoDay(-3),
        baseCurrency: 'EUR',
      })
      await api.push(tripId, [
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
        {
          entity: 'event',
          id: randomUUID(),
          changes: {
            kind: 'train',
            title: 'Coast line',
            status: 'paid',
            startsLocal: `${isoDay(-8)}T09:00`,
            startTz: 'UTC',
            endsLocal: `${isoDay(-8)}T13:00`,
            endTz: 'UTC',
          },
        },
      ])
    } finally {
      await api.dispose()
    }
  })

  test('a past trip with two countries: history, new stamps, two country stamps and the map offline', async ({
    page,
    context,
  }) => {
    await signIn(page, solo)

    // The history: the trip is where we have been, with its route and cover stamp.
    const past = page.getByTestId('history.past')
    await expect(past.getByTestId('trips.item')).toHaveCount(1)
    await expect(past.getByTestId('trips.item')).toContainText('Harbour City → Old Town')
    await expect(past.getByTestId('trips.item')).toContainText('2 countries')
    await expect(past.getByTestId('trips.item.stamp')).toHaveAttribute('data-code', 'XA')
    // Kiko celebrates the new stamps: two countries and two cities.
    await expect(page.getByTestId('history.celebration').locator('mk-mascot')).toHaveAttribute(
      'data-state',
      'celebrating'
    )
    await expect(page.getByTestId('history.newStamp')).toHaveCount(4)

    // The passport: a page per country, each with its stamp.
    await page.getByTestId('trips.passport').click()
    await expect(page).toHaveURL(/\/passport$/)
    await expect(page.getByTestId('passport.countryStamp')).toHaveCount(2)
    await expect(page.getByTestId('passport.country').first()).toContainText('Xaloa')
    await expect(page.getByTestId('passport.cityStamp')).toHaveCount(2)
    await expect(
      page.getByTestId('passport.countryStamp').locator('mk-stamp[data-reached]')
    ).toHaveCount(2)
    await expect(page.getByTestId('passport.cityStamp').nth(1).locator('mk-stamp')).toHaveAttribute(
      'data-icon',
      'train'
    )
    // A tap says when and on which trip.
    await page.getByTestId('passport.cityStamp').nth(1).locator('button').click()
    await expect(page.getByTestId('passport.detail.trip')).toHaveText('On Two-country loop')
    await page.keyboard.press('Escape')

    // The map, online first: the tiles do not answer, so the SVG view stays.
    await page.getByTestId('passport.openMap').click()
    await expect(page.getByTestId('passport.map')).toHaveAttribute('data-mode', 'fallback')
    await page.getByTestId('passport.map.back').click()
    await expect(page).toHaveURL(/\/passport$/)

    // Offline: the map is the SVG world view with the visited cities as dots.
    await context.setOffline(true)
    await page.getByTestId('passport.openMap').click()
    await expect(page.getByTestId('passport.map.offline')).toBeVisible()
    const map = page.getByTestId('passport.map')
    await expect(map).toHaveAttribute('data-mode', 'fallback')
    await expect(map.getByTestId('mk-world-map.place')).toHaveCount(2)
    await expect(map.getByTestId('mk-world-map.route')).toHaveCount(1)
    await expect(map.locator('mk-world-map')).toHaveAttribute(
      'aria-label',
      /Harbour City, Old Town/
    )
  })

  test('screenshots of the passport at 390 × 844, light and dark, and the generated stamps', async ({
    page,
  }) => {
    test.skip(!process.env.E2E_SCREENSHOTS, 'set E2E_SCREENSHOTS=1 to refresh them')
    mkdirSync(SCREENSHOTS, { recursive: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, solo)
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      await page.goto('/trips')
      await expect(page.getByTestId('history.newStamp')).toHaveCount(4)
      await page.screenshot({ path: `${SCREENSHOTS}history-390-${scheme}.png` })
      await page.goto('/passport')
      await expect(page.getByTestId('passport.countryStamp')).toHaveCount(2)
      await page.screenshot({ path: `${SCREENSHOTS}passport-390-${scheme}.png`, fullPage: true })
      await page.goto('/passport/map')
      await expect(page.getByTestId('passport.map')).toHaveAttribute('data-mode', 'fallback')
      await page.screenshot({ path: `${SCREENSHOTS}map-fallback-390-${scheme}.png` })
    }
    await page.emulateMedia({ colorScheme: 'light' })
    await page.setViewportSize({ width: 600, height: 844 })
    await page.goto('/styleguide')
    const sheet = page.getByTestId('styleguide.stampSheet')
    await sheet.scrollIntoViewIfNeeded()
    await expect(sheet.locator('mk-stamp')).toHaveCount(12)
    await sheet.screenshot({ path: `${SCREENSHOTS}generated-stamps.png` })
  })
})
