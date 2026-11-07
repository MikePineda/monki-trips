import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '../fixtures.ts'

/**
 * J09: the style guide, section by section and the four mock screens, at
 * 390 × 844 in light and dark, saved as PNGs under e2e/screenshots/styleguide
 * so the pull request can embed them for the design gate (stop 2).
 */
const SHOTS = fileURLToPath(new URL('../screenshots/styleguide/', import.meta.url))

const SECTIONS = [
  'tokens',
  'typography',
  'buttons',
  'chips',
  'route-chips',
  'fields',
  'rows',
  'event-rows',
  'ticket',
  'segmented',
  'stats',
  'banners',
  'progress',
  'tab-bar',
  'connection',
  'empty',
  'mascot',
  'stamps',
] as const

const SCREENS = ['today', 'trips', 'day', 'expense'] as const

test.describe('J09 styleguide visual', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

  for (const theme of ['light', 'dark'] as const) {
    test(`captures every section and the four mock screens in ${theme}`, async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true })
      await page.goto('/styleguide')
      await page.getByTestId(`styleguide.theme.${theme}`).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      // Still frames so the mascot and the screens are deterministic.
      await page.getByTestId('styleguide.mascot.still').getByRole('button').click()
      await expect(
        page.getByTestId('styleguide.mascot.happy').locator('mk-mascot').first()
      ).toHaveAttribute('data-motion', 'still')
      await page.evaluate(() => document.fonts.ready)

      for (const section of SECTIONS) {
        const locator = page.getByTestId(`styleguide.${section}`)
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeVisible()
        await locator.screenshot({
          path: `${SHOTS}${section}-${theme}.png`,
          animations: 'disabled',
        })
      }
      for (const screen of SCREENS) {
        const frame = page.getByTestId(`styleguide.mock.${screen}`).locator('mk-device-frame')
        await frame.scrollIntoViewIfNeeded()
        await expect(frame).toBeVisible()
        const box = await frame.boundingBox()
        expect(box?.width).toBe(390)
        expect(box?.height).toBe(844)
        await frame.screenshot({
          path: `${SHOTS}screen-${screen}-${theme}.png`,
          animations: 'disabled',
        })
      }
    })
  }

  test('the whole guide fits the phone width and has no raw keys in either language', async ({
    page,
  }) => {
    await page.goto('/styleguide')
    await expect(page.getByTestId('styleguide.tokens')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)

    for (const lang of ['en', 'es'] as const) {
      await page.getByTestId(`styleguide.lang.${lang}`).click()
      await expect(page.locator('html')).toHaveAttribute('lang', lang === 'en' ? 'en-AU' : 'es-MX')
      expect(await page.locator('body').innerText()).not.toMatch(
        /\b(?:styleguide|shell|ui)\.[a-zA-Z]+\.[a-zA-Z.]+/
      )
    }
  })
})
