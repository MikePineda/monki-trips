import AxeBuilder from '@axe-core/playwright'
import type { Browser, Locator, Page } from '@playwright/test'
import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { mockAssistantConversation } from '../assistant-mock.ts'
import { expect, test } from '../fixtures.ts'
import { seedTodayTrip } from '../today-trip.ts'
import { signIn } from '../sign-in.ts'

/**
 * QA-1: the accessibility audit of every screen at 390 × 844, light and
 * dark, on the synthetic Harbour escape trip (e2e/today-trip.ts) in split
 * mode, with a traveller without an account and one expense they share, so
 * the Balances segment has a settle-up line, signed in as the trip's owner.
 * Kiko's chat with an open proposal is a synthetic conversation
 * (e2e/assistant-mock.ts).
 *
 * - axe-core with the WCAG 2.0 A/AA, 2.1 AA and 2.2 AA rules: zero
 *   violations, or a dated entry in EXCEPTIONS with its reason.
 * - Tap targets: the design rule of docs/design/DESIGN.md, 44 × 44 CSS px
 *   for every control (stricter than WCAG 2.5.8's 24 px). A smaller visual
 *   passes when its hit area reaches 44 px around its centre (a pseudo
 *   element). Links inside running text are exempt (WCAG 2.5.8 "inline").
 * - Keyboard focus draws a ring: Tab through each screen and every focused
 *   control shows an outline of at least 2 px (or a box shadow).
 * - `<html lang>` follows the active language, English and Spanish.
 * - No horizontal overflow at 360 px on any screen.
 *
 * Motion is emulated as reduced so sheets are measured at rest, not halfway
 * through their entrance.
 */
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } })

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']

/** The minimum hit area, in CSS px, of every control (DESIGN.md, Layout: tap targets). */
const TAP_TARGET = 44

/**
 * Violations accepted for now, each with its date and reason. A screen of
 * `'*'` matches every screen. Keep this list short and specific: no rule is
 * disabled everywhere.
 */
const EXCEPTIONS: {
  rule: string
  screen: string
  target: string
  since: string
  reason: string
}[] = []

interface Screen {
  name: string
  /** Opens the screen and waits until its content is drawn. */
  open(page: Page): Promise<void>
}

interface Arranged {
  tripId: string
  eventId: string
  documentId: string
  inviteToken: string
}

async function arrange(account: E2eAccount): Promise<Arranged> {
  const trip = await seedTodayTrip(account)
  const api = await ApiSession.signIn(account)
  try {
    const snapshot = await api.snapshot(trip.tripId)
    const food = snapshot.budgetCategories.find((row) => row.key === 'food')!
    await api.push(trip.tripId, [
      {
        entity: 'traveller',
        id: crypto.randomUUID(),
        changes: { displayName: 'Traveller B', position: 1 },
      },
      { entity: 'trip', id: trip.tripId, changes: { budgetTotalMinor: 120_000 } },
      // Split mode: the lunch below gets the owner as payer and equal shares on the server.
      { entity: 'trip', id: trip.tripId, changes: { budgetMode: 'split' } },
      { entity: 'budget_category', id: food.id, changes: { budgetMinor: 30_000 } },
      {
        entity: 'expense',
        id: crypto.randomUUID(),
        changes: {
          amountMinor: 2_450,
          currency: 'EUR',
          spentOn: trip.startsOn,
          description: 'Harbour lunch',
          categoryId: food.id,
        },
      },
    ])
    const eventId = snapshot.events.find((event) => event.title === 'Harbour walk')!.id
    const documentId = snapshot.documents.find((doc) => doc.title === 'Entry pass')!.id
    const inviteToken = await api.createInvitationLink(trip.tripId)
    return { tripId: trip.tripId, eventId, documentId, inviteToken }
  } finally {
    await api.dispose()
  }
}

async function visible(locator: Locator): Promise<void> {
  await expect(locator.first()).toBeVisible({ timeout: 15_000 })
  // Lazy translation scopes can land after the ready marker (WebKit is slower):
  // measure only once every visible control carries its name.
  await locator.page().waitForFunction(
    () =>
      Array.from(document.querySelectorAll('button, a[href]')).every((element) => {
        const box = element.getBoundingClientRect()
        if (box.width === 0 || box.height === 0) return true
        const name = element.getAttribute('aria-label') ?? element.textContent ?? ''
        return name.trim().length > 0 || element.querySelector('[aria-label], img[alt]') !== null
      }),
    undefined,
    { timeout: 15_000 }
  )
}

function signedInScreens(t: Arranged): Screen[] {
  const trip = `/t/${t.tripId}`
  const go = (path: string, ready: (page: Page) => Locator): Screen['open'] => {
    return async (page) => {
      await page.goto(path)
      await visible(ready(page))
    }
  }
  return [
    { name: 'trips', open: go('/trips', (p) => p.getByTestId('trips.list')) },
    { name: 'passport', open: go('/passport', (p) => p.getByTestId('passport.openMap')) },
    {
      name: 'passport map',
      open: async (page) => {
        // The tile provider is never reached from the suite: the map is the SVG view.
        await page.route(/^https:\/\/tiles\.openfreemap\.org\//, (route) => route.abort())
        await page.goto('/passport/map')
        await visible(page.locator('[data-testid="passport.map"][data-mode="fallback"]'))
      },
    },
    { name: 'today', open: go(`${trip}/today`, (p) => p.getByTestId('today.day')) },
    { name: 'summary', open: go(`${trip}/summary`, (p) => p.getByTestId('trip.summary.dates')) },
    { name: 'plan days', open: go(`${trip}/plan`, (p) => p.getByTestId('plan.event')) },
    {
      name: 'event sheet',
      open: go(`${trip}/plan/e/${t.eventId}`, (p) => p.getByRole('dialog')),
    },
    { name: 'where we sleep', open: go(`${trip}/plan/nights`, (p) => p.getByTestId('plan.night')) },
    { name: 'docs', open: go(`${trip}/docs`, (p) => p.getByTestId('docs.row')) },
    {
      name: 'document quick view',
      open: async (page) => {
        await page.goto(`${trip}/docs/${t.documentId}`)
        const sheet = page.getByRole('dialog')
        await sheet.getByTestId('docs.detail.view').click()
        await visible(sheet.getByTestId('ui.preview.page'))
      },
    },
    { name: 'money', open: go(`${trip}/money`, (p) => p.getByTestId('money.stats')) },
    {
      name: 'quick expense sheet',
      open: async (page) => {
        await page.goto(`${trip}/money`)
        await visible(page.getByTestId('money.stats'))
        await page.getByTestId('shell.fab').click()
        await visible(page.getByRole('dialog').getByTestId('money.quick.amount'))
      },
    },
    {
      name: 'money balances',
      open: async (page) => {
        await page.goto(`${trip}/money`)
        await page.getByTestId('money.view.balances').click()
        await visible(page.getByTestId('money.settlement'))
      },
    },
    {
      name: 'split sheet',
      open: async (page) => {
        await page.goto(`${trip}/money`)
        await visible(page.getByTestId('money.stats'))
        await page.getByTestId('shell.fab').click()
        await page.getByTestId('ui.keypad.9').click()
        await page.getByTestId('money.quick.split').locator('button').click()
        await visible(page.getByTestId('money.split.done'))
      },
    },
    { name: 'more', open: go(`${trip}/more`, (p) => p.getByTestId('trip.more.list')) },
    { name: 'tasks', open: go(`${trip}/more/tasks`, (p) => p.getByTestId('tasks.add')) },
    {
      name: 'checklist',
      open: go(`${trip}/more/checklist`, (p) => p.getByTestId('checklist.title')),
    },
    {
      name: 'members',
      open: go(`${trip}/more/members`, (p) => p.getByTestId('trip.members.inviteSection')),
    },
    {
      name: 'activity',
      open: go(`${trip}/more/activity`, (p) => p.getByTestId('trip.activity.title')),
    },
    {
      name: 'emergency',
      open: go(`${trip}/more/emergency`, (p) => p.getByTestId(/^emergency\.(add|edit|empty)$/)),
    },
    {
      name: 'ready to fly',
      open: go(`${trip}/more/offline`, (p) => p.getByTestId('offline.ready')),
    },
    { name: 'phrases', open: go(`${trip}/more/phrases`, (p) => p.getByTestId('phrases')) },
    {
      name: 'assistant new chat',
      open: go(`${trip}/more/assistant`, (p) => p.getByTestId('assistant.suggestion')),
    },
    {
      name: 'assistant chat with a proposal',
      open: async (page) => {
        await page.goto(await mockAssistantConversation(page, t.tripId))
        await visible(page.getByTestId('assistant.proposal.accept'))
      },
    },
    {
      name: 'trip settings',
      open: go(`${trip}/more/settings`, (p) =>
        p.getByTestId('account.signOutEverywhere').filter({ hasText: /\w/ })
      ),
    },
    {
      name: 'settings',
      // The account section loads its own copy after the page: wait for it.
      open: go('/settings', (p) =>
        p.getByTestId('account.signOutEverywhere').filter({ hasText: /\w/ })
      ),
    },
    {
      name: 'styleguide',
      open: go('/styleguide', (p) => p.getByTestId('styleguide.components')),
    },
  ]
}

function signedOutScreens(t: Arranged): Screen[] {
  return [
    {
      name: 'login',
      open: async (page) => {
        await page.goto('/login')
        await visible(page.getByTestId('auth.login.submit'))
      },
    },
    {
      name: 'invitation preview',
      open: async (page) => {
        await page.goto(`/invite/${t.inviteToken}`)
        await visible(page.getByTestId('auth.invite.preview'))
      },
    },
  ]
}

async function axeViolations(page: Page, screen: string, scheme: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  const found: string[] = []
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const target = node.target.join(' ')
      const excused = EXCEPTIONS.some(
        (e) =>
          e.rule === violation.id &&
          (e.screen === '*' || e.screen === screen) &&
          target.includes(e.target)
      )
      if (!excused) {
        found.push(`${screen} (${scheme}) ${violation.id}: ${target} — ${node.failureSummary}`)
      }
    }
  }
  return found
}

/**
 * Controls whose hit area is smaller than TAP_TARGET. A control counts when
 * its box is big enough, or when the points TAP_TARGET / 2 from its centre
 * still hit it (an invisible hit area). A visually hidden native input is
 * measured through its label. Links inside running text are exempt.
 */
async function smallTargets(page: Page, minimum: number): Promise<string[]> {
  return page.evaluate((min) => {
    const selector = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'summary',
      '[role="button"]',
      '[role="tab"]',
      '[role="switch"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="link"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')
    const describe = (element: Element) => {
      const id = element.closest('[data-testid]')?.getAttribute('data-testid')
      return `${element.tagName.toLowerCase()}${id ? `[${id}]` : ''}`
    }
    const inRunningText = (element: Element) => {
      if (element.tagName !== 'A' || getComputedStyle(element).display !== 'inline') return false
      const parent = element.parentElement
      if (!parent) return false
      return Array.from(parent.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim().length > 0
      )
    }
    const found: string[] = []
    const seen = new Set<Element>()
    for (const control of Array.from(document.querySelectorAll(selector))) {
      if (control.closest('[inert], [aria-hidden="true"]')) continue
      if ((control as HTMLButtonElement).disabled) continue
      if (inRunningText(control)) continue
      let element: Element = control
      const box0 = control.getBoundingClientRect()
      if (control.tagName === 'INPUT' && (box0.width <= 1 || box0.height <= 1)) {
        // A visually hidden native input: its label is what people tap.
        element = control.closest('label') ?? control
      }
      if (seen.has(element)) continue
      seen.add(element)
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      element.scrollIntoView({ block: 'center', inline: 'center' })
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      if (box.width >= min - 0.5 && box.height >= min - 0.5) continue
      const cx = box.left + box.width / 2
      const cy = box.top + box.height / 2
      const covers: string[] = []
      const hits = (x: number, y: number) => {
        const hit = document.elementFromPoint(x, y)
        const inside = hit !== null && (hit === element || element.contains(hit))
        if (!inside) covers.push(hit ? describe(hit) : 'nothing')
        return inside
      }
      // Covered by something else (the tab bar, a sheet): not measurable here.
      if (!hits(cx, cy)) continue
      const reach = min / 2 - 1
      const wideEnough = box.width >= min - 0.5 || (hits(cx - reach, cy) && hits(cx + reach, cy))
      const tallEnough = box.height >= min - 0.5 || (hits(cx, cy - reach) && hits(cx, cy + reach))
      if (!wideEnough || !tallEnough) {
        const size = `${Math.round(box.width)}×${Math.round(box.height)}`
        found.push(`${describe(element)} ${size}, edge hits ${covers.join(' / ')}`)
      }
    }
    window.scrollTo(0, 0)
    return found
  }, minimum)
}

/** Tabs through the screen and answers the focused controls that draw no visible ring. */
async function focusWithoutRing(page: Page, presses: number): Promise<string[]> {
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.scrollTo(0, 0)
  })
  const found: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab')
    const report = await page.evaluate(() => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      const style = getComputedStyle(element)
      const ring =
        (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2) ||
        style.boxShadow !== 'none'
      const id = element.closest('[data-testid]')?.getAttribute('data-testid')
      const name = `${element.tagName.toLowerCase()}${id ? `[${id}]` : ''}`
      return { name: `${name} (outline ${style.outlineStyle} ${style.outlineWidth})`, ring }
    })
    if (report && !report.ring && !seen.has(report.name)) {
      seen.add(report.name)
      found.push(report.name)
    }
  }
  return found
}

/**
 * Elements whose visible box runs past the right or left edge of the
 * viewport, cut to each clipping ancestor first (same measure as J05c).
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

async function signedOutPage(browser: Browser, scheme: 'light' | 'dark'): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    colorScheme: scheme,
    reducedMotion: 'reduce',
    locale: 'en-AU',
  })
  return context.newPage()
}

test.describe('QA-1 accessibility audit of every screen', () => {
  // One worker, in order; a failed test re-arranges the trip for the next one.
  test.describe.configure({ mode: 'default' })
  test.setTimeout(240_000)

  let owner: E2eAccount
  let arranged: Arranged

  test.beforeAll(async ({}, testInfo) => {
    owner = soloAccount(testInfo.project.name, 'a11y')
    arranged = await arrange(owner)
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`every screen passes axe in ${scheme}`, async ({ page, browser }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      const found: string[] = []
      await signIn(page, owner)
      for (const screen of signedInScreens(arranged)) {
        await screen.open(page)
        found.push(...(await axeViolations(page, screen.name, scheme)))
      }
      const out = await signedOutPage(browser, scheme)
      try {
        for (const screen of signedOutScreens(arranged)) {
          await screen.open(out)
          found.push(...(await axeViolations(out, screen.name, scheme)))
        }
      } finally {
        await out.context().close()
      }
      expect(found, found.join('\n')).toEqual([])
    })
  }

  test('every control has a 44 × 44 px hit area', async ({ page, browser }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const found: string[] = []
    await signIn(page, owner)
    for (const screen of signedInScreens(arranged)) {
      await screen.open(page)
      for (const small of await smallTargets(page, TAP_TARGET))
        found.push(`${screen.name}: ${small}`)
    }
    const out = await signedOutPage(browser, 'light')
    try {
      for (const screen of signedOutScreens(arranged)) {
        await screen.open(out)
        for (const small of await smallTargets(out, TAP_TARGET)) {
          found.push(`${screen.name}: ${small}`)
        }
      }
    } finally {
      await out.context().close()
    }
    expect(found, found.join('\n')).toEqual([])
  })

  test('keyboard focus draws a visible ring on every screen', async ({ page, browser }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const found: string[] = []
    await signIn(page, owner)
    for (const screen of signedInScreens(arranged)) {
      await screen.open(page)
      for (const name of await focusWithoutRing(page, 12)) found.push(`${screen.name}: ${name}`)
    }
    const out = await signedOutPage(browser, 'dark')
    try {
      for (const screen of signedOutScreens(arranged)) {
        await screen.open(out)
        for (const name of await focusWithoutRing(out, 8)) found.push(`${screen.name}: ${name}`)
      }
    } finally {
      await out.context().close()
    }
    expect(found, found.join('\n')).toEqual([])
  })

  test('every screen has one main landmark, one page title and no skipped heading level', async ({
    page,
    browser,
  }) => {
    const found: string[] = []
    const outline = (target: Page) =>
      target.evaluate(() => {
        const problems: string[] = []
        const mains = document.querySelectorAll('main, [role="main"]')
        if (mains.length !== 1) problems.push(`${mains.length} main landmarks`)
        // A sheet is its own dialog; the page outline is what lies outside it.
        const outside = (element: Element) =>
          !element.closest('[role="dialog"], [aria-hidden="true"], [hidden], [inert]')
        const dialog = document.querySelector('[role="dialog"]')
        if (dialog) {
          // An open sheet hides the page from assistive technology: it carries its own name and title.
          const named = dialog.getAttribute('aria-label') || dialog.getAttribute('aria-labelledby')
          if (!named) problems.push('a sheet without an accessible name')
          if (!dialog.querySelector('h2')) problems.push('a sheet without an h2 title')
        } else {
          const titles = Array.from(document.querySelectorAll('h1')).filter(outside)
          if (titles.length !== 1) problems.push(`${titles.length} h1`)
        }
        let previous = 0
        for (const heading of Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
          if (!outside(heading)) continue
          const level = Number(heading.tagName[1])
          if (previous > 0 && level > previous + 1) {
            problems.push(`h${previous} then h${level} "${heading.textContent?.trim()}"`)
          }
          previous = level
        }
        return problems
      })
    await signIn(page, owner)
    for (const screen of signedInScreens(arranged)) {
      await screen.open(page)
      for (const problem of await outline(page)) found.push(`${screen.name}: ${problem}`)
    }
    const out = await signedOutPage(browser, 'light')
    try {
      for (const screen of signedOutScreens(arranged)) {
        await screen.open(out)
        for (const problem of await outline(out)) found.push(`${screen.name}: ${problem}`)
      }
    } finally {
      await out.context().close()
    }
    expect(found, found.join('\n')).toEqual([])
  })

  test('a sheet keeps the focus inside while open and gives it back to its opener', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await signIn(page, owner)
    const openers = [
      { path: `/t/${arranged.tripId}/money`, opener: page.getByTestId('shell.fab') },
      { path: `/t/${arranged.tripId}/plan`, opener: page.getByTestId('plan.event').first() },
    ]
    for (const { path, opener } of openers) {
      await page.goto(path)
      await opener.focus()
      await page.keyboard.press('Enter')
      const sheet = page.getByRole('dialog')
      await expect(sheet, path).toBeVisible()
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab')
        const inside = await sheet.evaluate((dialog) => dialog.contains(document.activeElement))
        expect(inside, `${path}: Tab ${i + 1} left the sheet`).toBe(true)
      }
      await page.keyboard.press('Escape')
      await expect(sheet, path).toHaveCount(0)
      await expect(opener, `${path}: focus back on the opener`).toBeFocused()
    }
  })

  test('the lang attribute follows the active language', async ({ page }) => {
    await signIn(page, owner)
    await page.goto(`/t/${arranged.tripId}/today`)
    await visible(page.getByTestId('today.day'))
    expect(await page.locator('html').getAttribute('lang')).toMatch(/^en\b/)

    await page.goto('/settings')
    await page.getByTestId('settings.lang.es').click()
    await expect(page.locator('html')).toHaveAttribute('lang', /^es\b/)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', /^es\b/)
    await page.goto(`/t/${arranged.tripId}/today`)
    await visible(page.getByTestId('today.day'))
    expect(await page.locator('html').getAttribute('lang')).toMatch(/^es\b/)

    // Back to English for the other tests of the file.
    await page.goto('/settings')
    await page.getByTestId('settings.lang.en').click()
    await expect(page.locator('html')).toHaveAttribute('lang', /^en\b/)
  })

  test('no screen runs past the right edge at 360 px', async ({ page, browser }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const found: string[] = []
    await signIn(page, owner)
    for (const screen of signedInScreens(arranged)) {
      await screen.open(page)
      for (const element of await overflowing(page)) found.push(`${screen.name}: ${element}`)
    }
    const out = await signedOutPage(browser, 'light')
    await out.setViewportSize({ width: 360, height: 780 })
    try {
      for (const screen of signedOutScreens(arranged)) {
        await screen.open(out)
        for (const element of await overflowing(out)) found.push(`${screen.name}: ${element}`)
      }
    } finally {
      await out.context().close()
    }
    expect(found, found.join('\n')).toEqual([])
  })
})
