import type { Page } from '@playwright/test'

/**
 * What Safari reports to a web app opened from the iPhone Home Screen,
 * which Playwright's WebKit cannot install: `navigator.standalone` is true
 * and the origin's storage is persistent (WebKit grants `persist()` to Home
 * Screen web apps, https://webkit.org/blog/14403/updates-to-storage-policy/;
 * a fresh Playwright context answers false). The WebKit counterpart of
 * `grantDurableStorage`; call it before the app first loads.
 */
export async function emulateInstalledIphoneApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true })
    StorageManager.prototype.persist = async () => true
    StorageManager.prototype.persisted = async () => true
  })
}
