import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { soloAccount, type E2eAccount } from '../accounts.ts'
import { randomUUID } from 'node:crypto'
import { ApiSession } from '../api-session.ts'
import { mockAssistantConversation } from '../assistant-mock.ts'
import { seedDepartureTrip } from '../departure-trip.ts'
import { expect, test } from '../fixtures.ts'
import { seedNarrowTrip, type NarrowTrip } from '../narrow-trip.ts'
import { signIn } from '../sign-in.ts'

/**
 * J05c: the trip screens on a narrow phone (360 × 780) with four-digit
 * amounts and long place names. The Money figures never overlap, the per
 * day figure before the trip spreads over the trip's days, the last line
 * of a list scrolls clear of the floating button, nothing runs past the
 * right edge (Where we sleep included: dates whole, long titles kept in
 * the row, the Phrases cards too) and the floating button stays inside
 * the viewport. The Notifications section of Settings (switches, quiet
 * hours, upcoming reminders) stays inside the screen too, and so do the
 * Balances segment of a split trip (long names, four-digit nets, the
 * "Mark as settled" buttons), the trip history, the passport and its map
 * with long place names, and Kiko's chat with an open proposal, its
 * composer above the tab bar.
 *
 * With E2E_SCREENSHOTS=1 it also writes the 390 × 844 screenshots of the
 * Money tab and Where we sleep, light and dark, to e2e/screenshots/money/
 * (E2E_SCREENSHOTS=before names them `*-before.png`).
 */
test.use({ serviceWorkers: 'block', viewport: { width: 360, height: 780 } })

const SCREENSHOTS = fileURLToPath(new URL('../screenshots/money/', import.meta.url))

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/**
 * Elements whose visible box runs past the right or left edge of the
 * viewport. What an ancestor clips (`overflow` other than visible) is not
 * visible, so the box is cut to each clipping ancestor first.
 */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const found: string[] = []
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      let left = box.left
      let right = box.right
      for (let up = element.parentElement; up && up !== document.body; up = up.parentElement) {
        if (getComputedStyle(up).overflowX === 'visible') continue
        const clip = up.getBoundingClientRect()
        left = Math.max(left, clip.left)
        right = Math.min(right, clip.right)
      }
      if (right <= left) continue
      if (right > width + 0.5 || left < -0.5) {
        const id = element.getAttribute('data-testid')
        found.push(`${element.tagName.toLowerCase()}${id ? `[${id}]` : ''} ${left}–${right}`)
      }
    }
    if (document.documentElement.scrollWidth > width) {
      found.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${width}`)
    }
    return found
  })
}

async function scrollToEnd(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
}

async function expectFabInside(page: Page, testId: string): Promise<Box> {
  const fab = await page.getByTestId(testId).boundingBox()
  expect(fab).not.toBeNull()
  const viewport = page.viewportSize()!
  expect(fab!.x).toBeGreaterThanOrEqual(0)
  expect(fab!.y).toBeGreaterThanOrEqual(0)
  expect(fab!.x + fab!.width).toBeLessThanOrEqual(viewport.width)
  expect(fab!.y + fab!.height).toBeLessThanOrEqual(viewport.height)
  return fab!
}

test.describe('J05c trip screens on a narrow phone', () => {
  // Every test wipes the account's trips in beforeEach: run them one after the other.
  test.describe.configure({ mode: 'default' })

  let solo: E2eAccount
  let trip: NarrowTrip

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j05c')
    trip = await seedNarrowTrip(solo)
  })

  test('the Money figures never overlap and the last category clears the floating button', async ({
    page,
  }) => {
    await signIn(page, solo)
    await page.goto(`/t/${trip.tripId}/money`)
    await expect(page.getByTestId('money.stat.spent')).toContainText('A$3,175.48')
    await expect(page.getByTestId('money.stat.remaining')).toContainText('A$4,773.12')
    // Before the trip the allowance spreads over the trip's 18 days, not the 100 days to its end.
    await expect(page.getByTestId('money.stat.perDay')).toContainText('A$265.17')
    await expect(page.getByTestId('money.stat.perDay')).toContainText('over 18 trip days')

    const tiles = await page.locator('[data-testid="money.stats"] mk-stat-tile').all()
    expect(tiles).toHaveLength(3)
    const parts: Box[] = []
    for (const tile of tiles) {
      for (const part of await tile.locator('p').all()) {
        parts.push((await part.boundingBox())!)
      }
    }
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        expect(overlaps(parts[i], parts[j]), `stat parts ${i} and ${j} overlap`).toBe(false)
      }
    }
    // No money is cut short: every value is drawn whole.
    for (const value of await page.locator('[data-testid="money.stats"] .mk-stat__value').all()) {
      const fits = await value.evaluate((element) => element.scrollWidth <= element.clientWidth)
      expect(fits).toBe(true)
    }

    // Food without spending reads like the others: an amount, then "of" its budget.
    const food = page.getByTestId('money.budget.chart.bar').filter({ hasText: 'Food' })
    await expect(food).toContainText('A$0.00')
    await expect(food).toContainText('of A$1,450.00')

    expect(await overflowing(page)).toEqual([])
    await scrollToEnd(page)
    const fab = await expectFabInside(page, 'shell.fab')
    const last = await page.getByTestId('money.budget.chart.bar').last().boundingBox()
    expect(last!.y + last!.height).toBeLessThanOrEqual(fab.y)
  })

  test('Where we sleep keeps whole dates and long titles inside the row', async ({ page }) => {
    await signIn(page, solo)
    await page.goto(`/t/${trip.tripId}/plan/nights`)
    await expect(page.getByTestId('plan.night')).toHaveCount(17)
    await expect(page.getByTestId('plan.night').nth(9)).toContainText('On board')

    expect(await overflowing(page)).toEqual([])
    for (const row of await page.getByTestId('plan.night').all()) {
      const title = row.locator('.mk-row__title')
      const meta = row.locator('.mk-row__meta')
      expect(await title.textContent()).not.toMatch(/…$/)
      expect(await title.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
      )
      // "Night 2 of 17" stays on one line.
      const metaBox = (await meta.boundingBox())!
      expect(metaBox.height).toBeLessThan(24)
    }
    // The night on board keeps its chevron inside the row.
    const onBoard = page.getByTestId('plan.night').nth(9)
    const chevron = await onBoard.locator('.mk-row__chevron').boundingBox()
    expect(chevron).not.toBeNull()
    expect(chevron!.x + chevron!.width).toBeLessThanOrEqual(page.viewportSize()!.width)

    await scrollToEnd(page)
    const fab = await expectFabInside(page, 'plan.add')
    const last = await page.getByTestId('plan.night').last().boundingBox()
    expect(last!.y + last!.height).toBeLessThanOrEqual(fab.y)
  })

  test('every trip screen with the floating button stays inside the viewport', async ({ page }) => {
    await signIn(page, solo)
    // The device holds the trip once the Money figures show; then every screen reads it.
    await page.goto(`/t/${trip.tripId}/money`)
    await expect(page.getByTestId('money.stat.perDay')).toContainText('A$265.17')
    const screens = [
      { path: 'today', fab: 'shell.fab' },
      { path: 'plan', fab: 'plan.add' },
      { path: 'docs', fab: 'shell.fab' },
      { path: 'money', fab: 'shell.fab' },
      { path: 'more', fab: 'shell.fab' },
      { path: 'more/members', fab: 'shell.fab' },
      { path: 'more/tasks', fab: 'shell.fab' },
      { path: 'more/phrases', fab: 'shell.fab' },
    ]
    for (const screen of screens) {
      await page.goto(`/t/${trip.tripId}/${screen.path}`)
      await expect(page.getByTestId(screen.fab), screen.path).toBeVisible()
      expect(await overflowing(page), screen.path).toEqual([])
      await scrollToEnd(page)
      await expectFabInside(page, screen.fab)
      // The page keeps room below its content for the floating button.
      const room = await page.evaluate(() => {
        const main = document.querySelector('mk-page')!
        return parseFloat(getComputedStyle(main).paddingBottom)
      })
      expect(room, screen.path).toBeGreaterThanOrEqual(56 + 64)
    }
  })

  test('the Balances segment keeps long names, nets and settle buttons inside the screen', async ({
    page,
  }) => {
    const arrange = await ApiSession.signIn(solo)
    try {
      const friends = [
        'Traveller B with a very long display name',
        'Traveller C from somewhere far away',
      ].map((displayName, index) => ({ id: randomUUID(), displayName, position: index + 1 }))
      await arrange.push(trip.tripId, [
        ...friends.map((friend) => ({
          entity: 'traveller',
          id: friend.id,
          changes: { displayName: friend.displayName, position: friend.position },
        })),
        { entity: 'trip', id: trip.tripId, changes: { budgetMode: 'split' } },
      ])
    } finally {
      await arrange.dispose()
    }

    await signIn(page, solo)
    await page.goto(`/t/${trip.tripId}/money`)
    await page.getByTestId('money.view.balances').click()
    await expect(page.getByTestId('money.balance')).toHaveCount(3)
    await expect(page.getByTestId('money.settlement')).toHaveCount(2)

    expect(await overflowing(page)).toEqual([])
    for (const button of await page.getByTestId('money.settle.mark').all()) {
      const box = (await button.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    }
    await scrollToEnd(page)
    const fab = await expectFabInside(page, 'shell.fab')
    const last = await page.getByTestId('money.settlement').last().boundingBox()
    expect(last!.y + last!.height).toBeLessThanOrEqual(fab.y)
  })

  test('the Phrases page keeps long cards inside the row and clears the floating button', async ({
    page,
  }) => {
    const arrange = await ApiSession.signIn(solo)
    try {
      expect(await arrange.generatePhraseCards(trip.tripId, 'th')).toBe(8)
    } finally {
      await arrange.dispose()
    }

    await signIn(page, solo)
    await page.goto(`/t/${trip.tripId}/more/phrases`)
    await page.getByTestId('phrases.language').selectOption('th')
    await expect(page.getByTestId('phrases.card')).toHaveCount(8)

    expect(await overflowing(page)).toEqual([])
    for (const card of await page.getByTestId('phrases.card').all()) {
      const chevron = await card.locator('.mk-row__chevron').boundingBox()
      expect(chevron).not.toBeNull()
      expect(chevron!.x + chevron!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    }

    await scrollToEnd(page)
    const fab = await expectFabInside(page, 'shell.fab')
    const last = await page.getByTestId('phrases.translate').boundingBox()
    expect(last!.y + last!.height).toBeLessThanOrEqual(fab.y)
  })

  test('the trip history and the passport stay inside the screen, long places included', async ({
    page,
  }) => {
    const arrange = await ApiSession.signIn(solo)
    try {
      await arrange.push(trip.tripId, [
        {
          entity: 'stop',
          id: randomUUID(),
          changes: {
            position: 0,
            name: 'The Long Lagoon Of Seven Bridges',
            countryCode: 'XC',
            lat: -8.5,
            lng: 115.25,
            tz: 'UTC',
            arriveOn: trip.startsOn,
            departOn: trip.startsOn,
          },
        },
        {
          entity: 'stop',
          id: randomUUID(),
          changes: {
            position: 1,
            name: 'Riverside Guesthouse Quarter',
            countryCode: 'XD',
            lat: 13.75,
            lng: 100.5,
            tz: 'UTC',
            arriveOn: trip.startsOn,
            departOn: trip.endsOn,
          },
        },
      ])
    } finally {
      await arrange.dispose()
    }

    // The tile provider is never reached from the suite: the map stays the SVG view.
    await page.route(/^https:\/\/tiles\.openfreemap\.org\//, (route) => route.abort())
    await signIn(page, solo)
    await expect(page.getByTestId('trips.item')).toContainText('The Long Lagoon Of Seven Bridges')
    expect(await overflowing(page), '/trips').toEqual([])
    await page.getByTestId('trips.passport').click()
    await expect(page.getByTestId('passport.countryStamp')).toHaveCount(2)
    expect(await overflowing(page), '/passport').toEqual([])
    await page.getByTestId('passport.openMap').click()
    await expect(page.getByTestId('passport.map')).toHaveAttribute(
      'data-mode',
      /fallback|loading|map/
    )
    expect(await overflowing(page), '/passport/map').toEqual([])
  })

  test('Kiko keeps an open proposal inside the screen and the composer above the tab bar', async ({
    page,
  }) => {
    await signIn(page, solo)
    await page.goto(await mockAssistantConversation(page, trip.tripId))
    const proposal = page.getByTestId('assistant.proposal')
    await expect(proposal).toHaveAttribute('data-status', 'proposed')
    // The long event title and both nights stay inside the card, flags included.
    await expect(proposal.getByTestId('ui.proposal.flag')).toHaveCount(2)
    expect(await overflowing(page)).toEqual([])
    // One floating control on this screen: the composer, never the expense button.
    await expect(page.getByTestId('shell.fab')).toHaveCount(0)

    const viewport = page.viewportSize()!
    const tabBar = (await page.locator('mk-tab-bar').boundingBox())!
    for (const where of ['top', 'end'] as const) {
      if (where === 'end') await scrollToEnd(page)
      const composer = (await page.getByTestId('assistant.composer').boundingBox())!
      // Flush on the tab bar (sub-pixel rounding aside).
      expect(composer.y + composer.height, where).toBeLessThanOrEqual(tabBar.y + 1)
      expect(composer.y, where).toBeGreaterThan(0)
      expect(composer.x + composer.width, where).toBeLessThanOrEqual(viewport.width)
    }
    // At the end of the conversation the decision buttons scroll clear of the composer.
    const composer = (await page.getByTestId('assistant.composer').boundingBox())!
    const accept = (await page.getByTestId('assistant.proposal.accept').boundingBox())!
    expect(accept.y + accept.height).toBeLessThanOrEqual(composer.y)
  })

  test('the Notifications settings section stays inside the screen, upcoming reminders included', async ({
    page,
  }) => {
    // A flight in twelve hours gives the upcoming list a "time to leave" row.
    const arrange = await ApiSession.signIn(solo)
    try {
      await arrange.saveNotificationSettings({
        leaveAt: true,
        checkOut: true,
        tasksDue: true,
        quietHoursStart: '22:30',
        quietHoursEnd: '07:00',
      })
    } finally {
      await arrange.dispose()
    }
    const departure = await seedDepartureTrip(solo)

    await signIn(page, solo)
    for (const path of [`/t/${departure.tripId}/more/settings`, '/settings']) {
      await page.goto(path)
      const reminders = page.getByTestId('settings.reminders')
      await expect(reminders, path).toHaveAttribute('data-ready', 'true')
      await expect(page.getByTestId('settings.notifications'), path).toBeVisible()
      await expect(page.getByTestId('settings.reminders.upcoming.row'), path).toHaveCount(1)
      await page.getByTestId('settings.notifications').scrollIntoViewIfNeeded()
      expect(await overflowing(page), path).toEqual([])
      // Quiet hours keep both ends whole side by side.
      const start = (await page.getByTestId('settings.reminders.quietStart').boundingBox())!
      const end = (await page.getByTestId('settings.reminders.quietEnd').boundingBox())!
      expect(overlaps(start, end), `${path}: quiet hours overlap`).toBe(false)
      // The reminder's time is drawn whole inside its row.
      const value = page.locator('[data-testid="settings.reminders.upcoming.row"] .mk-row__value')
      expect(await value.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
      )
    }
  })

  test('screenshots of Money and Where we sleep at 390 × 844, light and dark', async ({ page }) => {
    const mode = process.env.E2E_SCREENSHOTS
    test.skip(!mode, 'set E2E_SCREENSHOTS=1 to refresh them')
    // E2E_SCREENSHOTS=before keeps a copy of the screens before a layout fix, for a PR.
    const suffix = mode === 'before' ? '-before' : ''
    mkdirSync(SCREENSHOTS, { recursive: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, solo)
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(`/t/${trip.tripId}/money`)
      await expect(page.getByTestId('money.stat.perDay')).toContainText('A$265.17')
      await page.screenshot({ path: `${SCREENSHOTS}money-390-${scheme}${suffix}.png` })
      await page.goto(`/t/${trip.tripId}/plan/nights`)
      await expect(page.getByTestId('plan.night')).toHaveCount(17)
      await page.screenshot({ path: `${SCREENSHOTS}where-we-sleep-390-${scheme}${suffix}.png` })
    }
  })
})
