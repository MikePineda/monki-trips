import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../../testing/api-testing'
import { fakeActivityEntry } from '../../../../testing/fake-activity-api'
import { FAKE_SESSION_USER } from '../../../../testing/fake-session-api'
import { i18nTesting } from '../../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../../testing/offline-testing'
import { settle } from '../../../../testing/settle'
import { ApiFailure } from '../../../core/api/api-failure'
import type { MonkiTripsDb } from '../../../core/offline/db'
import { OnlineStore } from '../../../core/offline/online.store'
import { SessionStore } from '../../../core/session/session.store'
import ActivityPage from './activity.page'

/** Three changes, newest first; the server pages them two and one. */
const NEWEST = fakeActivityEntry({
  id: '3',
  actorUserId: FAKE_SESSION_USER.id,
  actorName: 'Traveller',
  entity: 'task',
  action: 'updated',
  fields: ['doneAt'],
  createdAt: '2026-11-07T11:40:00.000Z',
})
const MIDDLE = fakeActivityEntry({
  id: '2',
  entity: 'expense',
  action: 'created',
  fields: ['amountMinor', 'currency'],
  createdAt: '2026-11-06T16:30:00.000Z',
})
const OLDEST = fakeActivityEntry({
  id: '1',
  actorUserId: null,
  actorName: null,
  entity: 'event',
  action: 'deleted',
  fields: [],
  createdAt: '2026-10-20T08:00:00.000Z',
})

describe('ActivityPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    TestBed.configureTestingModule({
      imports: [ActivityPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  function pages() {
    fakes.activity.pages.set(null, { entries: [NEWEST, MIDDLE], nextCursor: 'after-2' })
    fakes.activity.pages.set('after-2', { entries: [OLDEST], nextCursor: null })
  }

  async function render() {
    await db.trips.put({
      id: 'trip-1',
      name: 'Sample trip',
      startDate: '2027-01-20',
      endDate: '2027-02-06',
      baseCurrency: 'EUR',
      homeTz: 'Asia/Bangkok',
      updatedAt: 'x',
    })
    await TestBed.inject(SessionStore).restore()
    const fixture = TestBed.createComponent(ActivityPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const has = (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null
    /** Dexie answers over several macrotasks: polls the DOM (after change detection) until `check` holds. */
    const until = (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    // The first page is asked on open; wait until it was answered (list, empty state or failure).
    await until(() =>
      expect(has('trip.activity.list') || has('trip.activity.error') || !has('mk-skeleton')).toBe(
        true
      )
    )
    return {
      fixture,
      host,
      has,
      until,
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
      rows: () =>
        [...host.querySelectorAll('[data-testid="trip.activity.item"]')].map(
          (row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        ),
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
    }
  }

  it('activity feed pages by cursor and caches offline', async () => {
    pages()
    const { rows, has, click, fixture, until } = await render()

    expect(fakes.activity.calls).toEqual(['activity:trip-1:first'])
    await until(() => expect(rows()).toHaveLength(2))
    expect(has('trip.activity.loadMore')).toBe(true)

    await click('trip.activity.loadMore')

    expect(fakes.activity.calls).toEqual(['activity:trip-1:first', 'activity:trip-1:after-2'])
    await until(() => expect(rows()).toHaveLength(3))
    expect(has('trip.activity.loadMore')).toBe(false)
    expect(await db.activity.where('tripId').equals('trip-1').count()).toBe(3)

    // The device goes offline and the page opens again: the saved lines show, nothing is asked.
    fixture.destroy()
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    const again = await render()

    await again.until(() => expect(again.rows()).toHaveLength(3))
    expect(fakes.activity.calls).toHaveLength(2)
    expect(again.has('trip.activity.error')).toBe(false)
    expect(
      again.host.querySelector<HTMLButtonElement>('[data-testid="trip.activity.refresh"]')?.disabled
    ).toBe(true)
  })

  it('lines read who did what, with the fields of an update, in the trip zone and language', async () => {
    pages()
    const { rows, click, until } = await render()
    await until(() => expect(rows()).toHaveLength(2))
    await click('trip.activity.loadMore')
    await until(() => expect(rows()).toHaveLength(3))

    const lines = rows()
    expect(lines[0]).toContain('You changed a task')
    expect(lines[0]).toContain('Changed: done at')
    expect(lines[0]).toContain('20 mins ago')
    expect(lines[1]).toContain('Partner added an expense')
    expect(lines[1]).not.toContain('Changed:')
    // 16:30 UTC on 6 Nov is 23:30 in Bangkok: yesterday there (seen from noon UTC on the 7th).
    expect(lines[1]).toContain('yesterday')
    expect(lines[2]).toContain('Someone removed an event')
    expect(lines[2]).toContain('20 Oct')
  })

  it('an honest empty state when nothing happened yet', async () => {
    const { has, text } = await render()

    expect(text('trip.activity.empty')).toContain('Nothing yet')
    expect(has('trip.activity.error')).toBe(false)
    expect(has('trip.activity.retry')).toBe(false)
  })

  it('a server without the feed explains it and keeps the saved lines', async () => {
    await db.activity.put({
      id: '9',
      tripId: 'trip-1',
      actorUserId: 'partner',
      actorName: 'Partner',
      entity: 'document',
      entityId: 'd1',
      action: 'created',
      fields: [],
      createdAt: '2026-11-07T10:00:00.000Z',
    })
    fakes.activity.failWith = new ApiFailure({
      kind: 'http',
      status: 404,
      code: 'E_ROUTE_NOT_FOUND',
      message: 'Route not found',
    })
    const { text, rows, has, until } = await render()

    expect(text('trip.activity.error')).toBe('This server does not serve the activity feed yet.')
    await until(() => expect(rows()).toEqual([expect.stringContaining('Partner added a document')]))
    expect(has('trip.activity.saved')).toBe(true)
  })

  it('with nothing saved, a failure offers to try again', async () => {
    fakes.activity.failWith = new TypeError('Failed to fetch')
    const { text, has, click, until } = await render()

    expect(text('trip.activity.error')).toContain('No connection')
    expect(has('trip.activity.retry')).toBe(true)

    pages()
    await click('trip.activity.retry')

    await until(() => expect(has('trip.activity.list')).toBe(true))
    expect(has('trip.activity.error')).toBe(false)
  })

  it('refresh asks the first page again and keeps older saved lines below it', async () => {
    pages()
    const { click, rows, until } = await render()
    await until(() => expect(rows()).toHaveLength(2))
    await click('trip.activity.loadMore')
    await until(() => expect(rows()).toHaveLength(3))
    fakes.activity.pages.set(null, {
      entries: [
        fakeActivityEntry({
          id: '4',
          entity: 'stop',
          action: 'created',
          createdAt: '2026-11-07T11:55:00.000Z',
        }),
        NEWEST,
      ],
      nextCursor: 'after-3',
    })

    await click('trip.activity.refresh')

    await until(() => expect(rows()).toHaveLength(4))
    expect(rows()[0]).toContain('Partner added a stop')
  })
})
