import { expect, test } from '../fixtures.ts'

/** Raw Transloco keys would look like `shell.trips.title`. */
const RAW_KEY = /\b(?:shell|settings|offline|ui|app|update|sync)\.[a-zA-Z]+\.[a-zA-Z.]+/

test.describe('J01 shell', () => {
  test('the trip list opens with the honest empty state and no tab bar', async ({ page }) => {
    await page.goto('/trips')

    await expect(page.getByTestId('shell.name')).toHaveText('monki trips')
    await expect(page.getByTestId('trips.empty')).toContainText('No trips yet')
    await expect(page.getByTestId('trips.empty').getByRole('button')).toHaveCount(0)
    await expect(page.getByTestId('shell.tab.today')).toHaveCount(0)
  })

  test('a trip route shows the five tabs and switches between placeholders', async ({ page }) => {
    await page.goto('/t/demo-trip')

    await expect(page).toHaveURL(/\/t\/demo-trip\/today$/)
    await expect(page.getByTestId('trip.today.title')).toBeVisible()
    for (const tab of ['today', 'plan', 'docs', 'money', 'more']) {
      await expect(page.getByTestId(`shell.tab.${tab}`)).toBeVisible()
    }
    await expect(page.getByTestId('shell.tab.today')).toHaveAttribute('aria-current', 'page')

    await page.getByTestId('shell.tab.money').click()
    await expect(page).toHaveURL(/\/t\/demo-trip\/money$/)
    await expect(page.getByTestId('trip.money.title')).toHaveText('Money')
    await expect(page.getByTestId('shell.tab.money')).toHaveAttribute('aria-current', 'page')

    await page.getByTestId('shell.back').click()
    await expect(page).toHaveURL(/\/trips$/)
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
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    await page.goto('/trips')
    await expect(page.getByTestId('trips.empty')).toContainText('Aún no hay viajes')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    await page.goto('/t/demo-trip/today')
    await expect(page.getByTestId('shell.tab.today')).toHaveText('Hoy')
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
