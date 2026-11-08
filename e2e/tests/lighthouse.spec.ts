import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { soloAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { auditPage, markdownRows, type PageScores } from '../lighthouse.ts'
import { expect, test } from '../fixtures.ts'
import { seedTodayTrip } from '../today-trip.ts'

/**
 * QA-1: Lighthouse (mobile preset) on the local production build, for the
 * login page, the styleguide and Today with a signed-in cookie. Accessibility
 * and best practices score at least 95 on all three; performance and
 * installability are reported, not gated (simulated throttling on a shared
 * VM is noisy). Opt in with E2E_LIGHTHOUSE=1; the scores land in
 * e2e/test-results-lighthouse/scores.md (gitignored) for the pull request.
 */
const OUT = fileURLToPath(new URL('../test-results-lighthouse/', import.meta.url))
const MINIMUM = 95

test.describe('QA-1 Lighthouse on the production build', () => {
  test.skip(!process.env.E2E_LIGHTHOUSE, 'set E2E_LIGHTHOUSE=1 to run Lighthouse')
  test.skip(({ browserName }) => browserName !== 'chromium', 'Lighthouse drives Chrome only')
  test.setTimeout(300_000)

  test('login, styleguide and Today score at least 95 in accessibility and best practices', async ({
    baseURL,
  }, testInfo) => {
    const owner = soloAccount(testInfo.project.name, 'a11y')
    const trip = await seedTodayTrip(owner)
    const api = await ApiSession.signIn(owner)
    let cookie: string
    try {
      cookie = await api.cookieHeader()
    } finally {
      await api.dispose()
    }

    // The full reports go next to the scores (read by auditPage).
    mkdirSync(OUT, { recursive: true })
    process.env.LIGHTHOUSE_REPORT_DIR = OUT
    const results: PageScores[] = [
      await auditPage('login', new URL('/login', baseURL).toString()),
      await auditPage('styleguide', new URL('/styleguide', baseURL).toString()),
      await auditPage('Today (signed in)', new URL(`/t/${trip.tripId}/today`, baseURL).toString(), {
        cookie,
      }),
    ]

    mkdirSync(OUT, { recursive: true })
    const table = [
      '| page | performance | accessibility | best practices | installable |',
      '| --- | --- | --- | --- | --- |',
      ...markdownRows(results),
      '',
      ...results.flatMap((r) => r.failing.map((audit) => `- ${r.page}: ${audit}`)),
      ...results.flatMap((r) => r.hints.map((hint) => `- ${r.page}: performance: ${hint}`)),
    ].join('\n')
    writeFileSync(`${OUT}scores.md`, `${table}\n`)
    console.log(table)

    // Today was measured signed in, not on the login page it would bounce to.
    expect(results[2].finalPath).toBe(`/t/${trip.tripId}/today`)
    for (const r of results) {
      expect(r.scores.accessibility, `${r.page} accessibility`).toBeGreaterThanOrEqual(MINIMUM)
      expect(r.scores['best-practices'], `${r.page} best practices`).toBeGreaterThanOrEqual(MINIMUM)
    }
  })
})
