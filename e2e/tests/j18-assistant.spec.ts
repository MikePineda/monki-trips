import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { mockAssistantConversation } from '../assistant-mock.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * J18: Kiko, the trip assistant. From Today a member opens the chat, asks
 * in their own words, watches the answer stream in with a proposal, and
 * accepts it; the expense then shows in Money and the proposal stays
 * accepted after a reload. The API runs `LLM_PROVIDER=fake`: every chat
 * turn of the run first calls `add_expense` (350 THB of food) and then
 * answers (e2e/fixtures/llm/chat/default.json). Runs on WebKit too (CI):
 * the stream is a `fetch` body reader, which Safari supports.
 *
 * With E2E_SCREENSHOTS=1 it also writes the 390 × 844 screenshots of the
 * chat with an open proposal, light and dark, to e2e/screenshots/assistant/.
 */
test.use({ serviceWorkers: 'block' })

const SCREENSHOTS = fileURLToPath(new URL('../screenshots/assistant/', import.meta.url))

/** A `YYYY-MM-DD` date `days` from today (UTC). */
function day(days: number): string {
  const at = new Date()
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

async function ask(page: Page, text: string): Promise<void> {
  await page.getByTestId('assistant.composer.input').fill(text)
  await page.getByTestId('assistant.send').click()
}

test.describe('J18 trip assistant', () => {
  // Both tests wipe and recreate the traveller's trip in beforeEach: one after the other.
  test.describe.configure({ mode: 'default' })

  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j18')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Lagoon week',
        startsOn: day(-1),
        endsOn: day(5),
        baseCurrency: 'AUD',
      })
    } finally {
      await api.dispose()
    }
  })

  test('asks, watches the answer stream in, accepts an expense and finds it in Money', async ({
    page,
  }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/today`)
    await page.getByTestId('today.assistant').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/more/assistant$`))
    await expect(page.getByTestId('assistant.suggestion')).toHaveCount(4)
    // Kiko's screen keeps one floating control: the composer, not the expense button.
    await expect(page.getByTestId('shell.fab')).toHaveCount(0)

    await ask(page, 'Log 350 baht of pad thai')
    const proposal = page.getByTestId('assistant.proposal')
    // The first message creates the conversation and the URL follows it.
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/more/assistant/[0-9a-f-]{36}$`))
    const chatUrl = page.url()
    await expect(page.getByTestId('assistant.send')).toBeVisible({ timeout: 30_000 })
    if ((await proposal.count()) === 0) {
      // A turn cut short in an earlier attempt shifts the fake's script by one call: ask again.
      await ask(page, 'Log 350 baht of pad thai')
      await expect(page.getByTestId('assistant.send')).toBeVisible({ timeout: 30_000 })
    }

    const answer = page.locator('[data-testid="assistant.message"][data-author="assistant"]')
    await expect(answer.last()).toContainText('I drafted the expense for you to check.')
    await expect(answer.last()).toContainText('Accept it and it goes into Money.')
    await expect(page.getByTestId('assistant.thinking')).toHaveCount(0)
    await expect(proposal).toHaveCount(1)
    await expect(proposal).toHaveAttribute('data-status', 'proposed')
    await expect(proposal).toContainText('฿350.00')
    // The base-currency value and the rate of the day (fake rates: 1 AUD = 33.75 / 1.5 THB).
    await expect(proposal).toContainText('$15.56')
    await expect(proposal).toContainText('1 AUD = 22.5 THB')
    await expect(page.getByTestId('assistant.announcer')).toContainText('Accept it')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    await proposal.getByTestId('assistant.proposal.accept').click()
    await expect(proposal).toHaveAttribute('data-status', 'accepted')
    await expect(proposal.getByTestId('ui.proposal.status')).toHaveText('Accepted')

    // The pull after accepting brings the expense to the device.
    await page.getByTestId('shell.tab.money').click()
    await page.getByTestId('money.view.expenses').click()
    const row = page.getByTestId('money.expense')
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    await expect(row).toContainText('Food')

    // Decided proposals keep their state across a reload.
    await page.goto(chatUrl)
    await expect(page.getByTestId('assistant.proposal')).toHaveAttribute('data-status', 'accepted')
    await expect(page.getByTestId('assistant.proposal.accept')).toHaveCount(0)
  })

  test('screenshots of the chat with an open proposal at 390 × 844, light and dark', async ({
    page,
  }) => {
    test.skip(!process.env.E2E_SCREENSHOTS, 'set E2E_SCREENSHOTS=1 to refresh them')
    mkdirSync(SCREENSHOTS, { recursive: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, solo)
    const url = await mockAssistantConversation(page, tripId)
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      await page.goto(url)
      const proposal = page.getByTestId('assistant.proposal')
      await expect(proposal).toHaveAttribute('data-status', 'proposed')
      await page.evaluate(() => document.fonts.ready)
      // The end of the conversation: the proposal with its decision buttons above the composer.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.screenshot({ path: `${SCREENSHOTS}chat-proposal-390-${scheme}.png` })
    }
  })
})
