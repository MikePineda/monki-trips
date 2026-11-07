import 'fake-indexeddb/auto'
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { DEMO_TRIP_RECORD } from '../../../testing/fake-trip-content'
import { i18nTesting } from '../../../testing/i18n-testing'
import { defaultCategoryRecords } from '../../../testing/money-fixtures'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { outboxMutation } from '../../core/offline/mutation'
import { BudgetEditSheet, type BudgetEditData } from './budget-edit.sheet'

describe('BudgetEditSheet', () => {
  let db: MonkiTripsDb
  let closed: unknown[]

  async function render(role: BudgetEditData['role']) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    closed = []
    const data: BudgetEditData = {
      trip: { ...DEMO_TRIP_RECORD, budgetTotalMinor: 100000 },
      role,
      categories: [{ id: 'cat-food', label: 'Food', budgetMinor: null }],
    }
    TestBed.configureTestingModule({
      imports: [BudgetEditSheet, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: (value: unknown) => closed.push(value) } },
      ],
    })
    await db.trips.put(data.trip)
    await db.budgetCategories.bulkPut(defaultCategoryRecords())
    const fixture = TestBed.createComponent(BudgetEditSheet)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      input: (id: string) => host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!,
      save: async () => {
        host.querySelector<HTMLElement>('[data-testid="money.budgetEdit.save"]')!.click()
        await settle(fixture)
      },
    }
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  it('an editor sets the trip total and a category budget: the contract keeps only the base currency for the owner', async () => {
    const { input, save } = await render('editor')
    expect(input('money.budgetEdit.total').value).toBe('1000.00')
    expect(input('money.budgetEdit.total').disabled).toBe(false)

    typeInto(input('money.budgetEdit.total'), '1200')
    typeInto(input('money.budgetEdit.category'), '250.5')
    await save()

    await vi.waitFor(() => expect(closed).toEqual([true]))
    const queued = (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
    expect(queued.map((mutation) => [mutation?.entity, mutation?.changes])).toEqual([
      ['trip', { budgetTotalMinor: 120000 }],
      ['budget_category', { budgetMinor: 25050 }],
    ])
  })

  it('nothing changed writes nothing', async () => {
    const { save } = await render('owner')
    await save()

    await vi.waitFor(() => expect(closed).toEqual([true]))
    expect(await db.outbox.count()).toBe(0)
  })
})
