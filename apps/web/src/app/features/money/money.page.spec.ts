import 'fake-indexeddb/auto'
import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { budgetStatus } from '@monkitrips/shared'
import { apiFakes, provideApiTesting } from '../../../testing/api-testing'
import { DEMO_TRIP_RECORD } from '../../../testing/fake-trip-content'
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
import type { ExpenseRecord } from '../../core/offline/records'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { formatMoney } from '../../domain/money'
import { ToastService } from '../../shared/ui/toast/toast.service'
import MoneyPage from './money.page'

/** Trip 2027-01-20 → 01-24, base AUD, A$1,000 budget; today is the 22nd. */
const TRIP = { ...DEMO_TRIP_RECORD, budgetTotalMinor: 100000 }

const EXPENSES: ExpenseRecord[] = [
  expenseRecord({
    id: 'flight',
    categoryId: 'cat-transport',
    amountMinor: 30000,
    baseAmountMinor: 30000,
    spentOn: '2026-12-01',
    description: 'Flight out',
    updatedAt: '2026-12-01T00:00:00.000Z',
  }),
  expenseRecord({
    id: 'lunch',
    categoryId: 'cat-food',
    amountMinor: 33750,
    currency: 'THB',
    fxRate: '22.5',
    fxSource: 'frankfurter',
    baseAmountMinor: 1500,
    spentOn: '2027-01-21',
    updatedAt: '2027-01-21T05:00:00.000Z',
  }),
  expenseRecord({
    id: 'ramen',
    categoryId: 'cat-food',
    amountMinor: 1200,
    currency: 'JPY',
    fxRate: null,
    fxSource: null,
    fxRateDate: null,
    baseAmountMinor: null,
    spentOn: '2027-01-22',
    needsDetails: true,
    syncState: 'pending',
    updatedAt: '2027-01-22T01:00:00.000Z',
  }),
]

describe('MoneyPage', () => {
  let db: MonkiTripsDb

  beforeEach(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [MoneyPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, clock: new TestClock('2027-01-22T03:00:00.000Z') }),
        ...provideApiTesting(apiFakes()),
        provideRouter([]),
        { provide: TIME_ZONE, useValue: 'UTC' },
      ],
    })
    await db.trips.put(TRIP)
    const categories = defaultCategoryRecords()
    categories[2] = { ...categories[2], budgetMinor: 20000 } // food
    categories[1] = { ...categories[1], budgetMinor: 25000 } // transport
    await db.budgetCategories.bulkPut(categories)
    await db.expenses.bulkPut(EXPENSES)
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(MoneyPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const all = (selector: string) => [...host.querySelectorAll<HTMLElement>(selector)]
    const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const until = (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    const tap = async (element: HTMLElement | null) => {
      element!.click()
      await settle(fixture)
    }
    const tile = (id: string) =>
      byId(`money.stat.${id}`)?.querySelector('.mk-stat__value')?.textContent?.trim()
    const tileSub = (id: string) =>
      byId(`money.stat.${id}`)?.querySelector('.mk-stat__sub')?.textContent?.trim()
    return { fixture, host, all, byId, until, tap, tile, tileSub }
  }

  it('remaining per day uses the shared budget status', async () => {
    const expected = budgetStatus({
      startsOn: TRIP.startDate,
      endsOn: TRIP.endDate,
      budgetTotalMinor: TRIP.budgetTotalMinor,
      baseCurrency: 'AUD',
      today: '2027-01-22',
      expenses: EXPENSES.map((expense) => ({
        ...expense,
        syncPending: expense.syncState === 'pending',
      })),
    })
    // The trip mixes currencies, so the base dollar is written A$.
    const money = (minor: bigint) => formatMoney(minor, 'AUD', 'en-AU', { disambiguate: true })
    const { tile, tileSub, until } = await render()

    await until(() => expect(tile('spent')).toBe(money(expected.spentMinor)))
    expect(tile('spent')).toBe('A$315.00')
    // The yen waiting for a rate is counted, not summed.
    expect(tileSub('spent')).toBe('1 waiting for a rate')
    expect(tile('remaining')).toBe(money(expected.remainingMinor!))
    expect(tile('perDay')).toBe(money(expected.allowanceTodayMinor!))
    // During the trip the allowance spreads over the days left, today included (22nd to 24th).
    expect(expected.allowanceDays).toBe(3)
    expect(tileSub('perDay')).toBe('over 3 days left')
  })

  it('before the trip the per-day figure spreads over the trip days and says so', async () => {
    // Today (2027-01-22) is 100 days before the end and the trip has 18 days.
    await db.trips.put({ ...TRIP, startDate: '2027-04-14', endDate: '2027-05-01' })
    const { tile, tileSub, until } = await render()

    await until(() => expect(tileSub('perDay')).toBe('over 18 trip days'))
    // (A$1,000 − A$315) / 18, floored to the cent.
    expect(tile('perDay')).toBe('A$38.05')
  })

  it('budget table view lists the same numbers as the bars', async () => {
    const { all, byId, until, tap } = await render()
    await until(() => expect(all('[data-testid="money.budget.chart.bar"]')).toHaveLength(6))

    const fromBars = all('[data-testid="money.budget.chart.bar"]').map((bar) => [
      bar.querySelector('[data-testid="ui.barChart.label"]')?.textContent?.trim(),
      bar.querySelector('[data-testid="ui.barChart.value"]')?.textContent?.trim(),
    ])
    expect(fromBars[1]).toEqual(['Transport', 'A$300.00'])
    expect(fromBars[2]).toEqual(['Food', 'A$15.00'])

    await tap(byId('money.budget.view.table'))
    await until(() => expect(all('[data-testid="money.budget.table.row"]')).toHaveLength(6))
    const fromTable = all('[data-testid="money.budget.table.row"]').map((row) => [
      row.querySelector('[data-column="category"]')?.textContent?.trim(),
      row.querySelector('[data-column="spent"]')?.textContent?.trim(),
    ])
    expect(fromTable).toEqual(fromBars)
    const food = all('[data-testid="money.budget.table.row"]')[2]
    expect(food.querySelector('[data-column="budget"]')?.textContent?.trim()).toBe('A$200.00')
    expect(food.querySelector('[data-column="left"]')?.textContent?.trim()).toBe('A$185.00')
    // A category without a budget is honest about it.
    expect(all('[data-testid="money.budget.table.row"]')[0].textContent).toContain('No budget')
  })

  it('lists expenses by day with their phase, waiting rates and filters', async () => {
    const { all, byId, until, tap, host } = await render()
    await tap(byId('money.view.expenses'))

    await until(() => expect(all('[data-testid="money.day"]')).toHaveLength(3))
    expect(all('[data-testid="money.day"]').map((day) => day.dataset['date'])).toEqual([
      '2027-01-22',
      '2027-01-21',
      '2026-12-01',
    ])
    expect(all('[data-testid="money.day.phase"]').map((chip) => chip.textContent?.trim())).toEqual([
      'During',
      'During',
      'Before',
    ])
    const ramen = host.querySelector('[data-expense-id="ramen"]')!
    expect(ramen.textContent).toContain('¥1,200')
    expect(ramen.textContent).toContain('waiting for rate')
    expect(ramen.textContent).toContain('add details')
    expect(ramen.textContent).toContain('pending')
    expect(host.querySelector('[data-expense-id="lunch"]')?.textContent).toContain('A$15.00')

    await tap(
      host.querySelector<HTMLElement>(
        '[data-testid="money.filter.phase"][data-phase="before"] button'
      )
    )
    await until(() => expect(all('[data-testid="money.expense"]')).toHaveLength(1))
    expect(all('[data-testid="money.expense"]')[0].textContent).toContain('Flight out')

    await tap(
      host.querySelector<HTMLElement>(
        '[data-testid="money.filter.category"][data-category-id="cat-food"] button'
      )
    )
    await until(() => expect(byId('money.expenses.noMatch')).not.toBeNull())
  })

  it('deleting from the edit sheet offers undo, which brings the expense back', async () => {
    const { byId, until, tap, host, all } = await render()
    await tap(byId('money.view.expenses'))
    await until(() => expect(all('[data-testid="money.expense"]')).toHaveLength(3))

    await tap(
      host.querySelector<HTMLElement>(
        '[data-expense-id="flight"] [data-testid="money.expense.edit"]'
      )
    )
    const sheet = await vi.waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-testid="money.edit.delete"]')
      expect(element).not.toBeNull()
      return element!
    })
    await tap(sheet)

    await until(() => expect(all('[data-testid="money.expense"]')).toHaveLength(2))
    const toasts = TestBed.inject(ToastService)
    expect(toasts.toasts()[0].message).toBe('Expense deleted')
    toasts.act(toasts.toasts()[0].id)
    await until(() => expect(all('[data-testid="money.expense"]')).toHaveLength(3))
    expect(host.textContent).toContain('Flight out')
  })

  describe('split trips', () => {
    const traveller = (
      id: string,
      displayName: string,
      userId: string | null,
      position: number
    ) => ({
      id,
      tripId: 'trip-1',
      displayName,
      userId,
      position,
      updatedAt: 'x',
    })
    const share = (id: string, expenseId: string, travellerId: string, shareMinor: number) => ({
      id,
      tripId: 'trip-1',
      expenseId,
      travellerId,
      shareMinor,
      updatedAt: 'x',
    })

    beforeEach(async () => {
      await db.expenses.clear()
      await db.travellers.bulkPut([
        traveller('v1', 'Traveller A', 'owner-user', 0),
        traveller('v2', 'Traveller B', 'local-traveller', 1),
        traveller('v3', 'Traveller C', null, 2),
      ])
      await db.members.put({
        id: 'm1',
        tripId: 'trip-1',
        userId: 'owner-user',
        role: 'owner',
        updatedAt: 'x',
      })
      await db.expenses.bulkPut([
        expenseRecord({
          id: 'dinner',
          categoryId: 'cat-food',
          amountMinor: 9000,
          baseAmountMinor: 9000,
          description: 'Dinner',
          paidByTravellerId: 'v1',
          spentOn: '2027-01-21',
        }),
        // No shares yet (made before the switch): everyone shares it equally.
        expenseRecord({
          id: 'taxi',
          categoryId: 'cat-transport',
          amountMinor: 3000,
          baseAmountMinor: 3000,
          description: 'Taxi',
          paidByTravellerId: 'v2',
          spentOn: '2027-01-22',
        }),
      ])
      await db.expenseShares.bulkPut([
        share('s1', 'dinner', 'v1', 4500),
        share('s2', 'dinner', 'v3', 4500),
      ])
    })

    const settlements = (host: HTMLElement) =>
      [...host.querySelectorAll<HTMLElement>('[data-testid="money.settlement"]')].map((row) =>
        row.textContent?.replace(/\s+/g, ' ').trim()
      )

    it('balances show the minimal settle up', async () => {
      await db.trips.put({ ...TRIP, budgetMode: 'split' })
      const { byId, tap, until, host } = await render()
      await until(() => expect(byId('money.view.balances')).not.toBeNull())

      await tap(byId('money.view.balances'))

      await until(() =>
        expect(host.querySelectorAll('[data-testid="money.balance"]')).toHaveLength(3)
      )
      const rows = [...host.querySelectorAll<HTMLElement>('[data-testid="money.balance"]')]
      expect(rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        expect.stringMatching(/Traveller A.*gets back.*A?\$35\.00/),
        expect.stringMatching(/Traveller B.*gets back.*A?\$20\.00/),
        expect.stringMatching(/Traveller C.*owes.*A?\$55\.00/),
      ])
      expect(settlements(host)).toEqual([
        expect.stringMatching(/Traveller C pays Traveller A.*35\.00/),
        expect.stringMatching(/Traveller C pays Traveller B.*20\.00/),
      ])
    })

    it('mark as settled zeroes the pair and leaves Spent unchanged', async () => {
      await db.trips.put({ ...TRIP, budgetMode: 'split' })
      const { byId, tap, until, host, tile, all } = await render()
      await until(() => expect(byId('money.view.balances')).not.toBeNull())
      const spent = tile('spent')
      expect(spent).toMatch(/120\.00/)
      await tap(byId('money.view.balances'))
      await until(() => expect(settlements(host)).toHaveLength(2))

      await tap(host.querySelector<HTMLElement>('[data-testid="money.settle.mark"]'))

      await until(() => expect(settlements(host)).toHaveLength(1))
      expect(settlements(host)[0]).toMatch(/Traveller C pays Traveller B/)
      const first = host.querySelector<HTMLElement>('[data-testid="money.balance"]')!
      expect(first.textContent).toContain('settled')
      const settlement = (await db.expenses.toArray()).find((row) => row.kind === 'settlement')
      expect(settlement).toMatchObject({
        description: 'Settle up',
        paidByTravellerId: 'v3',
        amountMinor: 3500,
        currency: 'AUD',
        categoryId: 'cat-other',
        syncState: 'pending',
      })
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Marked as settled')
      // Shown as history under Balances, never as spending.
      await until(() => expect(all('[data-testid="money.settled"]')).toHaveLength(1))
      expect(all('[data-testid="money.settled"]')[0].textContent).toMatch(
        /Traveller C paid Traveller A.*35\.00/s
      )
      expect(tile('spent')).toBe(spent)
      await tap(byId('money.view.expenses'))
      await until(() => expect(all('[data-testid="money.expense"]')).toHaveLength(2))
      await tap(byId('money.view.budget'))
      expect(host.textContent).not.toContain('155.00')
    })

    it('a double tap on Mark as settled records one settlement', async () => {
      await db.trips.put({ ...TRIP, budgetMode: 'split' })
      const { byId, tap, until, host } = await render()
      await until(() => expect(byId('money.view.balances')).not.toBeNull())
      await tap(byId('money.view.balances'))
      await until(() => expect(settlements(host)).toHaveLength(2))

      const button = host.querySelector<HTMLButtonElement>('[data-testid="money.settle.mark"]')!
      button.click()
      button.click()

      await until(() => expect(settlements(host)).toHaveLength(1))
      const recorded = (await db.expenses.toArray()).filter((row) => row.kind === 'settlement')
      expect(recorded).toHaveLength(1)
    })

    it('a settle up line with someone who left the trip cannot be marked as settled', async () => {
      await db.trips.put({ ...TRIP, budgetMode: 'split' })
      // Traveller C left the trip: the row is gone from the device, the share stays.
      await db.travellers.delete('v3')
      const { byId, tap, until, host } = await render()
      await until(() => expect(byId('money.view.balances')).not.toBeNull())
      await tap(byId('money.view.balances'))

      await until(() => expect(settlements(host).length).toBeGreaterThan(0))
      const gone = [
        ...host.querySelectorAll<HTMLElement>('[data-testid="money.settlement"]'),
      ].filter((row) => row.textContent?.includes('Someone who left the trip'))
      expect(gone.length).toBeGreaterThan(0)
      for (const row of gone) {
        const button = row.querySelector<HTMLButtonElement>('[data-testid="money.settle.mark"]')
        expect(button?.disabled).toBe(true)
        expect(row.textContent).toContain('left the trip and cannot be settled here')
      }
    })

    it('expense rows say who paid and between how many', async () => {
      await db.trips.put({ ...TRIP, budgetMode: 'split' })
      const { byId, tap, until, host } = await render()
      await tap(byId('money.view.expenses'))

      await until(() =>
        expect(host.querySelector('[data-expense-id="dinner"]')?.textContent).toContain(
          'Paid by Traveller A · split 2 ways'
        )
      )
      expect(host.querySelector('[data-expense-id="taxi"]')?.textContent).toContain(
        'Paid by Traveller B · split 3 ways'
      )
    })

    it('shared mode hides payer and shares', async () => {
      const { byId, tap, until, host } = await render()
      await tap(byId('money.view.expenses'))

      await until(() => expect(host.querySelector('[data-expense-id="dinner"]')).not.toBeNull())
      expect(host.textContent).not.toContain('Paid by')
      expect(byId('money.view.balances')).toBeNull()
    })
  })
})
