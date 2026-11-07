import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * Stands in for the push service inside the page: `PushManager.subscribe`
 * hands out a deterministic subscription and `getSubscription` remembers it
 * across reloads (localStorage), so the journey runs on a machine with no
 * route to a real push service. Permission, the user gesture, the VAPID
 * key, the API registration and the service worker are all real.
 */
function stubPushService({ endpoint }: { endpoint: string }) {
  const KEY = 'e2e.push.subscribed'
  const subscription = () => ({
    endpoint,
    expirationTime: null,
    options: { userVisibleOnly: true, applicationServerKey: null },
    toJSON: () => ({ endpoint, keys: { p256dh: 'e2e-p256dh', auth: 'e2e-auth' } }),
    getKey: () => null,
    unsubscribe: async () => {
      localStorage.removeItem(KEY)
      return true
    },
  })
  PushManager.prototype.subscribe = async function () {
    localStorage.setItem(KEY, '1')
    return subscription() as unknown as PushSubscription
  }
  PushManager.prototype.getSubscription = async function () {
    return localStorage.getItem(KEY) ? (subscription() as unknown as PushSubscription) : null
  }
}

test.describe('J14 notifications', () => {
  let solo: E2eAccount
  let endpoint: string

  test.beforeEach(async ({ context }, testInfo) => {
    solo = soloAccount(testInfo.project.name)
    // One endpoint per project: a retry upserts the same row instead of adding one.
    endpoint = `https://push.example.com/e2e/${testInfo.project.name}`
    await context.grantPermissions(['notifications'])
    await context.addInitScript(stubPushService, { endpoint })
  })

  test('enables notifications on the device, sends a test and the API knows the device', async ({
    page,
  }) => {
    await signIn(page, solo)
    await page.goto('/settings')
    const section = page.getByTestId('settings.notifications')
    await expect(section).toHaveAttribute('data-status', 'off')

    await page.getByTestId('settings.notifications.deviceLabel').fill('Test phone')
    await page.getByTestId('settings.notifications.toggle').click()
    // The subscription waits for the service worker to become active.
    await expect(section).toHaveAttribute('data-status', 'enabled', { timeout: 45_000 })
    await expect(page.getByTestId('settings.notifications.toggle')).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await expect(section).toContainText('Enabled on this device')

    await page.getByTestId('settings.notifications.test').click()
    await expect(page.getByTestId('ui.toast')).toContainText('Test notification sent')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    // Through the API, as the same account: the test reaches exactly this device.
    const api = await ApiSession.signIn(solo)
    try {
      expect(await api.sendPushTest()).toEqual({ sent: 1, pruned: 0, failed: 0 })
    } finally {
      await api.dispose()
    }

    // The choice survives a reload (the id lives on the device).
    await page.reload()
    await expect(section).toHaveAttribute('data-status', 'enabled')

    // Switching off unsubscribes the browser and forgets the device on the server.
    await page.getByTestId('settings.notifications.toggle').click()
    await expect(section).toHaveAttribute('data-status', 'off')
    const after = await ApiSession.signIn(solo)
    try {
      expect(await after.sendPushTest()).toEqual({ sent: 0, pruned: 0, failed: 0 })
    } finally {
      await after.dispose()
    }
  })
})
