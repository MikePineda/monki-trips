import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { chromium } from '@playwright/test'

/** The Lighthouse categories the audit reports, by their Lighthouse ids. */
export const CATEGORIES = ['performance', 'accessibility', 'best-practices'] as const
export type Category = (typeof CATEGORIES)[number]

export interface PageScores {
  /** The page's name in the report: never its URL (the base may be a real host). */
  page: string
  scores: Record<Category, number>
  /** Chrome's own installability verdict (Lighthouse 12+ has no PWA category). */
  installable: boolean
  installabilityErrors: string[]
  /** Audits below a score of 1 in accessibility and best practices, by id. */
  failing: string[]
  /** Performance audits that are not green, with their estimated saving. */
  hints: string[]
  /** The path the page ended on (a signed-in page that bounced to /login shows here). */
  finalPath: string
}

/**
 * Runs Lighthouse (its default mobile preset: Moto G-class screen, simulated
 * slow 4G and CPU throttling) on one URL with the Chrome from CHROME_PATH,
 * and asks the same Chrome whether the page is installable. `cookie` goes
 * out as a request header on every request, so a signed-in page can be
 * measured without a login form. Nothing here prints the URL.
 */
export async function auditPage(
  page: string,
  url: string,
  options: { cookie?: string } = {}
): Promise<PageScores> {
  const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  })
  try {
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: [...CATEGORIES],
        extraHeaders: options.cookie ? { Cookie: options.cookie } : undefined,
      },
      undefined
    )
    if (!result) throw new Error(`Lighthouse returned nothing for ${page}`)
    const { lhr } = result
    if (process.env.LIGHTHOUSE_REPORT_DIR) {
      const name = page.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
      writeFileSync(join(process.env.LIGHTHOUSE_REPORT_DIR, `${name}.json`), JSON.stringify(lhr))
    }
    const scores = Object.fromEntries(
      CATEGORIES.map((id) => [id, Math.round((lhr.categories[id]?.score ?? 0) * 100)])
    ) as Record<Category, number>
    const failing = (['accessibility', 'best-practices'] as const).flatMap((id) =>
      (lhr.categories[id]?.auditRefs ?? [])
        .filter((ref) => ref.weight > 0)
        .map((ref) => lhr.audits[ref.id])
        .filter((audit) => audit && audit.score !== null && audit.score < 1)
        .map((audit) => `${id}: ${audit.id}`)
    )
    const hints = (lhr.categories.performance?.auditRefs ?? [])
      .map((ref) => lhr.audits[ref.id])
      .filter((audit) => audit && audit.score !== null && audit.score < 0.9)
      .map((audit) => `${audit.id}${audit.displayValue ? ` (${audit.displayValue})` : ''}`)
    const finalPath = new URL(lhr.finalDisplayedUrl).pathname
    const installability = await installabilityOf(chrome.port, url, options.cookie)
    return {
      page,
      scores,
      installable: installability.length === 0,
      installabilityErrors: installability,
      failing,
      hints,
      finalPath,
    }
  } finally {
    chrome.kill()
  }
}

/** `Page.getInstallabilityErrors` on the same Chrome, after the page and its worker settle. */
async function installabilityOf(port: number, url: string, cookie?: string): Promise<string[]> {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
  try {
    const context = browser.contexts()[0] ?? (await browser.newContext())
    if (cookie) await context.setExtraHTTPHeaders({ Cookie: cookie })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'load' })
    // The manifest and the service worker register after the first render.
    await page.waitForTimeout(3_000)
    const session = await context.newCDPSession(page)
    const { installabilityErrors } = (await session.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: { errorId: string }[]
    }
    return installabilityErrors.map((error) => error.errorId)
  } finally {
    await browser.close()
  }
}

/** One Markdown table row per page, for the pull request. */
export function markdownRows(results: PageScores[]): string[] {
  return results.map(
    (r) =>
      `| ${r.page} | ${r.scores.performance} | ${r.scores.accessibility} | ${r.scores['best-practices']} | ${r.installable ? 'yes' : `no (${r.installabilityErrors.join(', ')})`} |`
  )
}

/**
 * CLI for public pages only (no cookie, no login): the base URL is read from
 * the environment variable named by `--base-env` and never printed.
 *
 *   node e2e/lighthouse.ts --base-env SMOKE_BASE_URL login styleguide
 */
async function main(argv: string[]): Promise<void> {
  const flag = argv.indexOf('--base-env')
  if (flag < 0 || !argv[flag + 1]) {
    throw new Error('usage: node e2e/lighthouse.ts --base-env <VAR> <path>...')
  }
  const base = process.env[argv[flag + 1]]
  if (!base) throw new Error(`${argv[flag + 1]} is not set`)
  const paths = argv.filter((_, i) => i !== flag && i !== flag + 1)
  const results: PageScores[] = []
  for (const path of paths) {
    results.push(await auditPage(path, new URL(`/${path}`, base).toString()))
  }
  console.log('| page | performance | accessibility | best practices | installable |')
  console.log('| --- | --- | --- | --- | --- |')
  for (const row of markdownRows(results)) console.log(row)
  for (const r of results) {
    for (const audit of r.failing) console.log(`${r.page} ${audit}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main(process.argv.slice(2))
}
