import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import { taskFixture } from '../../../testing/task-fixtures'
import type { MonkiTripsDb } from '../../core/offline/db'
import { outboxMutation } from '../../core/offline/mutation'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { ToastService } from '../../shared/ui/toast/toast.service'
import TasksPage from './tasks.page'

describe('TasksPage', () => {
  let db: MonkiTripsDb
  let clock: TestClock

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    db = freshOfflineDb()
    // Noon UTC on 2026-11-07: today is 2026-11-07 in UTC.
    clock = new TestClock('2026-11-07T12:00:00.000Z')
    TestBed.configureTestingModule({
      imports: [TasksPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, clock }),
        { provide: TIME_ZONE, useValue: 'UTC' },
        provideRouter([]),
      ],
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(TasksPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const all = (selector: string) => [...host.querySelectorAll<HTMLElement>(selector)]
    return {
      fixture,
      host,
      all,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      itemIds: (group: string) =>
        all(`[data-testid="tasks.group.${group}"] [data-testid="tasks.item"]`).map(
          (row) => row.dataset['taskId']
        ),
      settle: () => settle(fixture),
      /** Waits until the device copy reached the screen. */
      until: (check: () => void) =>
        vi.waitFor(() => {
          fixture.detectChanges()
          check()
        }),
    }
  }

  it('tasks are grouped by urgency, done ones behind a switch', async () => {
    await db.tasks.bulkPut([
      taskFixture({ id: 'late', dueOn: '2026-11-01' }),
      taskFixture({ id: 'now', dueOn: '2026-11-07', priority: 'high' }),
      taskFixture({ id: 'soon', dueOn: '2026-11-12' }),
      taskFixture({ id: 'later', dueOn: '2026-12-24' }),
      taskFixture({ id: 'someday' }),
      taskFixture({ id: 'finished', dueOn: '2026-11-01', doneAt: '2026-11-02T00:00:00.000Z' }),
      taskFixture({ id: 'elsewhere', tripId: 'trip-2', dueOn: '2026-11-01' }),
    ])
    const { itemIds, has, host, all, until } = await render()

    await until(() => expect(itemIds('overdue')).toEqual(['late']))
    expect(itemIds('today')).toEqual(['now'])
    expect(itemIds('this_week')).toEqual(['soon'])
    expect(itemIds('later')).toEqual(['later'])
    expect(itemIds('no_date')).toEqual(['someday'])
    expect(has('tasks.group.done')).toBe(false)
    expect(host.textContent).not.toContain('Task elsewhere')
    // A high task says so with its status.
    expect(
      all('[data-testid="tasks.group.today"] [data-testid="tasks.item"]')[0].textContent
    ).toContain('High')
  })

  it('completing a task is optimistic and undoable', async () => {
    // Offline, so the mutation stays visible in the outbox instead of being sent at once.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await db.tasks.put(taskFixture({ id: 'k1', dueOn: '2026-11-07' }))
    const { host, itemIds, settle, until } = await render()
    await until(() => expect(itemIds('today')).toEqual(['k1']))
    const toasts = TestBed.inject(ToastService)

    host.querySelector<HTMLElement>('[data-testid="tasks.item.toggle"]')!.click()
    await settle()

    // Off the open list at once, pending on the device, one mutation queued.
    await until(() => expect(itemIds('today')).toEqual([]))
    const stored = await db.tasks.get('k1')
    expect(stored?.doneAt).toBe('2026-11-07T12:00:00.000Z')
    expect(stored?.syncState).toBe('pending')
    const queued = (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({
      entity: 'task',
      op: 'upsert',
      id: 'k1',
      changes: { doneAt: '2026-11-07T12:00:00.000Z' },
    })
    expect(toasts.toasts()[0].message).toBe('Task done')

    toasts.act(toasts.toasts()[0].id)
    await settle()

    await until(() => expect(itemIds('today')).toEqual(['k1']))
    expect((await db.tasks.get('k1'))?.doneAt).toBeNull()
  })

  it('a quick add queues the task offline and shows it pending', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { host, itemIds, settle, until } = await render()

    typeInto(
      host.querySelector<HTMLInputElement>('[data-testid="tasks.add.title"]')!,
      'Buy an adapter'
    )
    typeInto(host.querySelector<HTMLInputElement>('[data-testid="tasks.add.dueOn"]')!, '2026-11-09')
    host
      .querySelector<HTMLFormElement>('[data-testid="tasks.add"]')!
      .dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()

    await until(() => expect(itemIds('this_week')).toHaveLength(1))
    expect(host.querySelector('[data-testid="ui.checkRow.pending"]')).not.toBeNull()
    const queued = (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
    expect(queued[0]).toMatchObject({
      entity: 'task',
      op: 'upsert',
      changes: { title: 'Buy an adapter', dueOn: '2026-11-09', priority: 'normal' },
    })
    expect(host.querySelector<HTMLInputElement>('[data-testid="tasks.add.title"]')!.value).toBe('')
  })

  it('a task that comes from a document links to the document to print', async () => {
    await db.tasks.put(
      taskFixture({
        id: 'print',
        title: 'Night train voucher',
        titleKey: 'print_document',
        origin: 'document',
        sourceDocumentId: 'doc-1',
      })
    )
    const { host, until } = await render()
    await until(() =>
      expect(host.querySelector('[data-testid="tasks.item.document"]')).not.toBeNull()
    )
    const link = host.querySelector<HTMLAnchorElement>('[data-testid="tasks.item.document"]')!

    expect(host.textContent).toContain('Print Night train voucher')
    expect(link.getAttribute('href')).toBe('/t/trip-1/docs/doc-1')
  })
})
