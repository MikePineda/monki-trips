import { randomUUID } from 'node:crypto'
import { soloAccount } from '../accounts.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn, signOut } from '../sign-in.ts'

const solo = soloAccount()

test.describe('J01 sign in, trips, sign out', () => {
  // The journey relies on the solo traveller's list starting empty: one test owns that account's trips.
  test.describe.configure({ mode: 'serial' })

  test('a wrong password is refused with an honest message', async ({ page }) => {
    await page.goto('/login')

    await page.getByTestId('login.email').fill(solo.email)
    await page.getByTestId('login.password').fill('not-the-password')
    await page.getByTestId('login.submit').click()

    await expect(page.getByTestId('login.error')).toHaveText(
      'That e-mail and password do not match.'
    )
    await expect(page).toHaveURL(/\/login$/)
  })

  test('signs in, sees the empty list, creates a trip, opens it and signs out', async ({
    page,
  }) => {
    await page.goto('/trips')
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftrips$/)
    await signIn(page, solo)

    await expect(page.getByTestId('trips.empty')).toContainText('No trips yet')
    await expect(page.getByTestId('shell.tab.today')).toHaveCount(0)

    await page.getByTestId('trips.create').click()
    const sheet = page.getByRole('dialog')
    await sheet.getByTestId('trips.create.name').fill('Solo escape')
    await sheet.getByTestId('trips.create.startsOn').fill('2027-03-01')
    await sheet.getByTestId('trips.create.endsOn').fill('2027-03-10')
    await sheet.getByTestId('trips.create.baseCurrency').fill('eur')
    await sheet.getByTestId('trips.create.budgetMode').selectOption('split')
    await sheet.getByTestId('trips.create.submit').click()

    await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\/today$/)
    await expect(page.getByTestId('shell.name')).toHaveText('Solo escape')
    for (const tab of ['today', 'plan', 'docs', 'money', 'more']) {
      await expect(page.getByTestId(`shell.tab.${tab}`)).toBeVisible()
    }
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    await page.getByTestId('shell.back').click()
    await expect(page).toHaveURL(/\/trips$/)
    await expect(page.getByTestId('trips.item')).toHaveCount(1)
    await expect(page.getByTestId('trips.item')).toContainText('Solo escape')
    await expect(page.getByTestId('trips.item')).toContainText('2027-03-01 to 2027-03-10')

    // A reload keeps the session (cookie) and the list (server, then device copy).
    await page.reload()
    await expect(page.getByTestId('trips.item')).toContainText('Solo escape')

    await signOut(page)
    await page.goto('/trips')
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftrips$/)
  })

  test('a trip you are not a member of is not found, never forbidden', async ({ page }) => {
    await signIn(page, solo)

    await page.goto(`/t/${randomUUID()}/today`)

    await expect(page).toHaveURL(/\/not-found$/)
    await expect(page.getByTestId('trips.notFound')).toContainText('Trip not found')
    expect(await page.locator('body').innerText()).not.toMatch(/forbidden/i)
  })
})

test.describe('J01 shell', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, solo)
  })

  test('the theme choice flips data-theme and survives a reload', async ({ page }) => {
    await page.goto('/settings')
    const html = page.locator('html')
    await expect(html).not.toHaveAttribute('data-theme', /./)

    const themeColor = page.locator('meta[name="theme-color"]')
    const lightSurface = await themeColor.getAttribute('content')
    expect(lightSurface).toMatch(/^#[0-9a-f]{6}$/)

    await page.getByTestId('settings.theme.dark').click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    // The browser chrome follows --surface-0 of the theme being shown.
    await expect(themeColor).toHaveAttribute('content', /^#[0-9a-f]{6}$/)
    await expect(themeColor).not.toHaveAttribute('content', lightSurface!)

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByTestId('settings.theme.dark')).toHaveAttribute('aria-checked', 'true')

    await page.getByTestId('settings.theme.system').click()
    await expect(html).not.toHaveAttribute('data-theme', /./)
  })

  test('switching to Spanish re-renders without raw keys and is remembered', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')

    await page.getByTestId('settings.lang.es').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajustes')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-MX')
    await expect(page.getByTestId('account.signOut')).toContainText('Cerrar sesión')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    await page.goto('/trips')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Viajes')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })

  test('the style guide is public, shows both themes and is not indexed', async ({ page }) => {
    await page.goto('/styleguide')

    await expect(page.getByTestId('styleguide.tokens')).toBeVisible()
    await expect(page.getByTestId('styleguide.theme-panel.light')).toHaveAttribute(
      'data-theme',
      'light'
    )
    await expect(page.getByTestId('styleguide.theme-panel.dark')).toHaveAttribute(
      'data-theme',
      'dark'
    )
    await expect(page.getByTestId('styleguide.mascot')).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    // Every component is rendered once per theme panel: drive the light one.
    const light = page.getByTestId('styleguide.theme-panel.light')
    await light.getByTestId('styleguide.open-sheet').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await light.getByTestId('styleguide.show-toast').click()
    await expect(page.getByTestId('ui.toast')).toContainText('Expense saved')
  })

  test('the custom service worker (sw.js) controls the page in production', async ({ page }) => {
    await page.goto('/trips')

    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration()
            const worker = registration?.active ?? registration?.waiting ?? registration?.installing
            return worker?.scriptURL ?? null
          }),
        { timeout: 45_000 }
      )
      .toMatch(/\/sw\.js$/)
  })
})
