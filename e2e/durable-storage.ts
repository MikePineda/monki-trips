import type { Browser, Page } from '@playwright/test'

/**
 * Chromium answers `navigator.storage.persist()` from site engagement,
 * which a fresh headless profile never has; an installed app gets the
 * `durableStorage` permission. This grants it to the page's own browser
 * context (Playwright contexts are not Chromium's default one, so the
 * context id is looked up from the page's target). Chromium only; call it
 * while the page is still on `about:blank`, before the app first asks.
 */
export async function grantDurableStorage(
  browser: Browser,
  page: Page,
  origin: string
): Promise<void> {
  const pageUrl = page.url()
  // The override lives as long as the DevTools session that set it: the
  // session stays attached until the browser closes (detaching revokes it).
  const cdp = await browser.newBrowserCDPSession()
  const { targetInfos } = (await cdp.send('Target.getTargets')) as {
    targetInfos: { type: string; url: string; browserContextId?: string }[]
  }
  const target = targetInfos.find((info) => info.type === 'page' && info.url === pageUrl)
  if (!target?.browserContextId) {
    throw new Error(`no page target at ${pageUrl} to grant durable storage to`)
  }
  await cdp.send('Browser.grantPermissions', {
    origin,
    permissions: ['durableStorage'],
    browserContextId: target.browserContextId,
  })
}
