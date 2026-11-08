import 'fake-indexeddb/auto'
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting } from '../../../testing/api-testing'
import { DEMO_TRIP_RECORD, blankStop } from '../../../testing/fake-trip-content'
import { i18nTesting } from '../../../testing/i18n-testing'
import { defaultCategoryRecords, expenseRecord } from '../../../testing/money-fixtures'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { outboxMutation } from '../../core/offline/mutation'
import { toStopRecord } from '../../core/offline/stop-record'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { META_SESSION } from '../../core/offline/meta.store'
import { SessionStore } from '../../core/session/session.store'
import { FAKE_SESSION_USER } from '../../../testing/fake-session-api'
import { QuickExpenseSheet, type QuickExpenseResult } from './quick-expense.sheet'

describe('QuickExpenseSheet', () => {
  let db: MonkiTripsDb
  let closedWith: QuickExpenseResult[]

  beforeEach(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    closedWith = []
    TestBed.configureTestingModule({
      imports: [QuickExpenseSheet, i18nTesting()],
      providers: [
        // 03:00 UTC on the 21st is noon in Tokyo: lunch time at the stop.
        ...provideOfflineTesting({ db, clock: new TestClock('2027-01-21T03:00:00.000Z') }),
        ...provideApiTesting(apiFakes()),
        provideRouter([]),
        { provide: TIME_ZONE, useValue: 'UTC' },
        { provide: DIALOG_DATA, useValue: { tripId: 'trip-1' } },
        {
          provide: DialogRef,
          useValue: { close: (result: QuickExpenseResult) => closedWith.push(result) },
        },
      ],
    })
    await db.trips.put(DEMO_TRIP_RECORD)
    await db.budgetCategories.bulkPut(defaultCategoryRecords())
    await db.stops.put(
      toStopRecord(
        blankStop({
          countryCode: 'JP',
          tz: 'Asia/Tokyo',
          arriveOn: '2027-01-20',
          departOn: '2027-01-24',
        })
      )
    )
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(QuickExpenseSheet)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const tap = async (id: string) => {
      byId(id)!.click()
      await settle(fixture)
    }
    const until = (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    const selectedCategory = () =>
      host
        .querySelector('[data-testid="money.quick.category"].mk-chip--selected')
        ?.getAttribute('data-category-key')
    return { fixture, host, byId, tap, until, selectedCategory }
  }

  it('currency defaults to the current stop', async () => {
    const { byId, tap, until } = await render()

    await until(() => expect((byId('money.quick.currency') as HTMLSelectElement).value).toBe('JPY'))
    // Yen have no decimals: the separator key does nothing.
    await tap('ui.keypad.1')
    await tap('ui.keypad..')
    await tap('ui.keypad.5')
    expect(byId('money.quick.amount')?.textContent?.trim()).toBe('¥15')
  })

  it('preselects the category of the time of day, then the one used last', async () => {
    const first = await render()
    await first.until(() => expect(first.selectedCategory()).toBe('food'))
    first.fixture.destroy()

    await db.expenses.put(
      expenseRecord({
        id: 'x0',
        categoryId: 'cat-transport',
        updatedAt: '2027-01-21T02:00:00.000Z',
      })
    )
    const second = await render()
    await second.until(() => expect(second.selectedCategory()).toBe('transport'))
  })

  it('quick expense saves with amount and category only', async () => {
    const { tap, until, byId, selectedCategory } = await render()
    await until(() => expect(selectedCategory()).toBe('food'))
    expect(byId('money.quick.save')?.hasAttribute('disabled')).toBe(true)

    await tap('ui.keypad.4')
    await tap('ui.keypad.5')
    await tap('ui.keypad.0')
    await tap('money.quick.save')

    await until(() => expect(closedWith).toHaveLength(1))
    const saved = closedWith[0]!.expense
    expect(await db.expenses.get(saved.id)).toMatchObject({
      amountMinor: 450,
      currency: 'JPY',
      categoryId: 'cat-food',
      spentOn: '2027-01-21',
      needsDetails: true,
      baseAmountMinor: null,
      syncState: 'pending',
    })
    const queued = (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ entity: 'expense', op: 'upsert', id: saved.id })
  })

  it('another category is one tap on its chip', async () => {
    const { tap, until, host, selectedCategory } = await render()
    await until(() => expect(selectedCategory()).toBe('food'))

    host
      .querySelector<HTMLElement>(
        '[data-testid="money.quick.category"][data-category-key="shopping"] button'
      )!
      .click()
    await tap('ui.keypad.9')
    await tap('money.quick.save')

    await until(() => expect(closedWith).toHaveLength(1))
    expect((await db.expenses.get(closedWith[0]!.expense.id))?.categoryId).toBe('cat-shopping')
  })

  describe('in split mode', () => {
    beforeEach(async () => {
      await db.trips.put({ ...DEMO_TRIP_RECORD, budgetMode: 'split' })
      await db.travellers.bulkPut([
        {
          id: 'v1',
          tripId: 'trip-1',
          displayName: 'Traveller A',
          userId: 'someone-else',
          position: 0,
          updatedAt: 'x',
        },
        {
          id: 'v2',
          tripId: 'trip-1',
          displayName: 'Traveller B',
          userId: FAKE_SESSION_USER.id,
          position: 1,
          updatedAt: 'x',
        },
        {
          id: 'v3',
          tripId: 'trip-1',
          displayName: 'Traveller C',
          userId: null,
          position: 2,
          updatedAt: 'x',
        },
      ])
      // Offline: the session comes back from the device's cached copy.
      await db.meta.put({ key: META_SESSION, value: FAKE_SESSION_USER })
      await TestBed.inject(SessionStore).restore()
    })

    it('split chip keeps quick expense at three taps by default', async () => {
      const { tap, until, byId } = await render()
      await until(() =>
        expect(byId('money.quick.split')?.textContent).toContain('Paid by Traveller B')
      )
      expect(byId('money.quick.split')?.textContent).toContain('3')

      // Amount and Save: with the FAB tap that opened the sheet, three taps.
      await tap('ui.keypad.9')
      await tap('money.quick.save')

      await until(() => expect(closedWith).toHaveLength(1))
      const saved = closedWith[0]!.expense
      expect(saved.paidByTravellerId).toBe('v2')
      const shares = await db.expenseShares.where('expenseId').equals(saved.id).toArray()
      expect(shares.map((row) => [row.travellerId, row.shareMinor]).sort()).toEqual([
        ['v1', 3],
        ['v2', 3],
        ['v3', 3],
      ])
    })
  })

  it('shared mode shows no split chip and sends no shares', async () => {
    const { tap, until, byId } = await render()
    await until(() => expect(byId('money.quick.save')).not.toBeNull())
    expect(byId('money.quick.split')).toBeNull()

    await tap('ui.keypad.9')
    await tap('money.quick.save')

    await until(() => expect(closedWith).toHaveLength(1))
    expect(await db.expenseShares.count()).toBe(0)
  })
})
