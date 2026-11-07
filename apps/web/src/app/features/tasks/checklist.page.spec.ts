import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { FakeSyncApi } from '../../../testing/fake-sync-api'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { outboxMutation } from '../../core/offline/mutation'
import { SyncService } from '../../core/offline/sync.service'
import { PRE_TRIP_TEMPLATE } from '../../domain/pre-trip-template'
import ChecklistPage from './checklist.page'
import { TasksStore } from './tasks.store'

describe('ChecklistPage', () => {
  let db: MonkiTripsDb
  let api: FakeSyncApi
  let online: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    db = freshOfflineDb()
    api = new FakeSyncApi()
    await db.trips.put({
      id: 'trip-1',
      name: 'Solo escape',
      startDate: '2027-03-01',
      endDate: '2027-03-10',
      baseCurrency: 'EUR',
      updatedAt: 'x',
    })
    TestBed.configureTestingModule({
      imports: [ChecklistPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db, api }), provideRouter([])],
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(ChecklistPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture, 6)
      },
      until: (check: () => void) =>
        vi.waitFor(() => {
          fixture.detectChanges()
          check()
        }),
      itemKeys: () =>
        [...host.querySelectorAll<HTMLElement>('[data-testid="checklist.item"]')].map(
          (row) => row.dataset['itemKey']
        ),
    }
  }

  it('template request is idempotent offline and online', async () => {
    online.mockReturnValue(false)
    const { click, itemKeys, host, until } = await render()
    await until(() => expect(host.querySelector('[data-testid="checklist.add"]')).not.toBeNull())

    await click('checklist.add')

    await until(() => expect(itemKeys()).toEqual(PRE_TRIP_TEMPLATE.map((item) => item.key)))
    expect(await db.outbox.count()).toBe(PRE_TRIP_TEMPLATE.length)
    expect(api.pushedIds()).toEqual([])
    const stored = await db.tasks.where('tripId').equals('trip-1').toArray()
    expect(stored.every((task) => task.origin === 'template' && task.syncState === 'pending')).toBe(
      true
    )
    expect(stored.find((task) => task.templateItemKey === 'before_leaving.print')).toMatchObject({
      title: 'Print the documents',
      titleKey: 'template.before_leaving.print',
      dueOn: '2027-02-28',
      priority: 'high',
    })
    const queued = (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
    expect(queued[0]?.changes).toMatchObject({
      origin: 'template',
      templateItemKey: 'documents.passport',
    })

    // Back online: everything syncs once, and asking again adds nothing.
    online.mockReturnValue(true)
    await TestBed.inject(SyncService).push()
    expect(api.pushedIds()).toHaveLength(PRE_TRIP_TEMPLATE.length)
    expect(await db.outbox.count()).toBe(0)

    expect(host.querySelector('[data-testid="checklist.addMissing"]')).toBeNull()
    expect(await TestBed.inject(TasksStore).addTemplate('trip-1', '2027-03-01', (key) => key)).toBe(
      0
    )
    expect(await db.tasks.count()).toBe(PRE_TRIP_TEMPLATE.length)
    expect(await db.outbox.count()).toBe(0)
  })

  it('groups the items by category with the progress on top, and ticking an item is ticking the task', async () => {
    const { click, host, fixture, until } = await render()
    await until(() => expect(host.querySelector('[data-testid="checklist.add"]')).not.toBeNull())
    await click('checklist.add')
    await until(() =>
      expect(host.querySelectorAll('[data-testid="checklist.item"]')).toHaveLength(7)
    )

    const categories = [
      ...host.querySelectorAll<HTMLElement>('[data-testid^="checklist.category."]'),
    ].map((section) => section.dataset['testid'])
    expect(categories).toEqual([
      'checklist.category.documents',
      'checklist.category.gear',
      'checklist.category.before_leaving',
    ])
    expect(host.querySelector('[data-testid="ui.progress.count"]')?.textContent).toContain('0 of 7')

    host.querySelector<HTMLElement>('[data-testid="checklist.item.toggle"]')!.click()
    await settle(fixture)

    await until(() =>
      expect(host.querySelector('[data-testid="ui.progress.count"]')?.textContent).toContain(
        '1 of 7'
      )
    )
    const passport = (await db.tasks.toArray()).find(
      (task) => task.templateItemKey === 'documents.passport'
    )
    expect(passport?.doneAt).not.toBeNull()
  })
})
