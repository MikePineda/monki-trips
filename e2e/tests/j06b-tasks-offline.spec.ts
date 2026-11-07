import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * J06b: a task added with no connection is queued on the device, shows as
 * pending, and reaches the server exactly once when the connection comes
 * back; the pre-trip checklist template then adds its items. The service
 * worker is blocked so the journey proves the outbox, not the cache (J07
 * covers the cold offline boot).
 */
test.use({ serviceWorkers: 'block' })

test.describe('J06b tasks offline and the pre-trip checklist', () => {
  // Both tests start by wiping the account's trips: run them one after the other.
  test.describe.configure({ mode: 'default' })

  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j06b')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Checklist escape',
        startsOn: '2027-03-01',
        endsOn: '2027-03-10',
        baseCurrency: 'EUR',
      })
    } finally {
      await api.dispose()
    }
  })

  test('a task added offline shows as pending and syncs exactly once when back online', async ({
    page,
    context,
  }) => {
    const pushes: { mutations: { entity: string; changes: Record<string, unknown> }[] }[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/v1/sync/push')) {
        pushes.push(request.postDataJSON())
      }
    })
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/more/tasks`)
    await expect(page.getByTestId('tasks.empty')).toBeVisible()

    await context.setOffline(true)
    await page.getByTestId('tasks.add.title').fill('Buy a power adapter')
    await page.getByTestId('tasks.add.dueOn').fill('2027-02-20')
    await page.getByTestId('tasks.add.submit').click()

    const row = page.getByTestId('tasks.item')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Buy a power adapter')
    await expect(row.getByTestId('ui.checkRow.pending')).toBeVisible()
    await expect(page.getByTestId('tasks.group.later')).toBeVisible()
    expect(pushes).toHaveLength(0)

    await context.setOffline(false)
    await expect(row.getByTestId('ui.checkRow.pending')).toHaveCount(0, { timeout: 15_000 })
    await expect(row).toContainText('Buy a power adapter')

    const sent = pushes
      .flatMap((push) => push.mutations)
      .filter(
        (mutation) =>
          mutation.entity === 'task' && mutation.changes['title'] === 'Buy a power adapter'
      )
    expect(sent).toHaveLength(1)
    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      expect(snapshot.tasks.filter((task) => task.title === 'Buy a power adapter')).toHaveLength(1)
    } finally {
      await api.dispose()
    }
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })

  test('adding the pre-trip checklist creates its items as tasks, grouped by category', async ({
    page,
  }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/more/checklist`)
    await expect(page.getByTestId('checklist.empty')).toBeVisible()

    await page.getByTestId('checklist.add').click()

    await expect(page.getByTestId('checklist.item')).toHaveCount(7)
    for (const category of ['documents', 'gear', 'before_leaving']) {
      await expect(page.getByTestId(`checklist.category.${category}`)).toBeVisible()
    }
    await expect(page.getByTestId('ui.progress.count')).toHaveText('0 of 7')
    await expect(page.getByTestId('ui.toast')).toContainText('7 checklist items added')
    await expect(page.getByTestId('checklist.addMissing')).toHaveCount(0)

    // The first item is ticked offline-style (optimistic) and the progress follows at once.
    await page.getByTestId('checklist.item.toggle').first().click()
    await expect(page.getByTestId('ui.progress.count')).toHaveText('1 of 7')

    // Everything reaches the server once the outbox drains.
    await expect(page.getByTestId('ui.checkRow.pending')).toHaveCount(0, { timeout: 15_000 })
    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      expect(snapshot.tasks).toHaveLength(7)
      expect(snapshot.tasks.filter((task) => task.doneAt !== null)).toHaveLength(1)
    } finally {
      await api.dispose()
    }
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
