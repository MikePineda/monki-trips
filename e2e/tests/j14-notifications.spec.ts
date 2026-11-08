import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { seedDepartureTrip } from '../departure-trip.ts'
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

  test('reminder choices stick across a reload and shape the upcoming reminders', async ({
    page,
  }, testInfo) => {
    // Its own account: this journey replaces the account's trips and settings.
    const traveller = soloAccount(testInfo.project.name, 'j14')
    const arrange = await ApiSession.signIn(traveller)
    try {
      await arrange.saveNotificationSettings({
        leaveAt: true,
        checkOut: true,
        tasksDue: true,
        quietHoursStart: null,
        quietHoursEnd: null,
      })
    } finally {
      await arrange.dispose()
    }
    const { tripId, flightId } = await seedDepartureTrip(traveller)

    await signIn(page, traveller)
    await page.goto('/settings')
    const reminders = page.getByTestId('settings.reminders')
    await expect(reminders).toHaveAttribute('data-ready', 'true')
    const leaveAt = page.getByTestId('settings.reminders.leaveAt')
    await expect(leaveAt).toHaveAttribute('aria-checked', 'true')

    // The flight in twelve hours plans a "time to leave" that opens the flight.
    const leaveRow = reminders.locator(
      '[data-testid="settings.reminders.upcoming.row"][data-kind="leave_at"]'
    )
    await expect(leaveRow).toHaveCount(1)
    await expect(leaveRow).toContainText('Flight to Port Vellmar')
    await expect(leaveRow.locator('a')).toHaveAttribute('href', `/t/${tripId}/plan/e/${flightId}`)

    // Turning "Time to leave" off saves at once and plans it away.
    await leaveAt.click()
    await expect(leaveAt).toHaveAttribute('aria-checked', 'false')
    await expect(leaveRow).toHaveCount(0)
    await expect(page.getByTestId('settings.reminders.upcoming.empty')).toBeVisible()

    // The choice lives on the server: a reload keeps it off.
    await page.reload()
    await expect(reminders).toHaveAttribute('data-ready', 'true')
    await expect(leaveAt).toHaveAttribute('aria-checked', 'false')
    await expect(leaveRow).toHaveCount(0)
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)

    const check = await ApiSession.signIn(traveller)
    try {
      expect(await check.notificationSettings()).toMatchObject({ leaveAt: false, checkOut: true })
    } finally {
      await check.dispose()
    }
  })
})
