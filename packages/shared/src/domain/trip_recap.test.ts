import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tripRecap, type RecapExpense, type RecapInput, type RecapStop } from './trip_recap.ts'
import type { TripEvent } from './trip_event.ts'
import { zonedFromLocal } from './zoned_instant.ts'

// A synthetic five-day trip, base EUR: three invented cities in two countries.
const trip = {
  startsOn: '2026-03-01',
  endsOn: '2026-03-05',
  baseCurrency: 'EUR',
  budgetTotalMinor: 100_000,
}

const stops: RecapStop[] = [
  { position: 0, name: 'Alderport', countryCode: 'PT', lat: 38.72, lng: -9.14 },
  { position: 1, name: 'Brisa', countryCode: 'PT', lat: 41.15, lng: -8.61 },
  { position: 2, name: 'Corvel', countryCode: 'ES', lat: 40.42, lng: -3.7 },
]

function at(local: string): ReturnType<typeof zonedFromLocal> {
  return zonedFromLocal(local, 0)
}

function event(
  id: string,
  extra: Partial<TripEvent> & Pick<TripEvent, 'kind' | 'starts'>
): TripEvent {
  return { id, status: 'booked', title: id, ends: null, ...extra }
}

function expense(
  id: string,
  baseAmountMinor: number | null,
  extra: Partial<RecapExpense> = {}
): RecapExpense {
  return {
    id,
    kind: 'expense',
    categoryId: 'food',
    amountMinor: baseAmountMinor ?? 1_000,
    currency: 'EUR',
    baseAmountMinor,
    spentOn: '2026-03-02',
    ...extra,
  }
}

function recap(extra: Partial<RecapInput> = {}) {
  return tripRecap({ trip, stops, events: [], expenses: [], today: '2026-03-20', ...extra })
}

test('a past trip counts its days, nights, countries and cities in order', () => {
  const result = recap()
  assert.equal(result.phase, 'past')
  assert.equal(result.finished, true)
  assert.equal(result.days, 5)
  assert.equal(result.nights, 4)
  assert.deepEqual(result.countries, ['PT', 'ES'])
  assert.deepEqual(result.cities, ['Alderport', 'Brisa', 'Corvel'])
  assert.equal(result.empty, false)
})

test('the distance is the great-circle sum over consecutive stops', () => {
  const result = recap()
  // Alderport → Brisa ≈ 274 km, Brisa → Corvel ≈ 422 km.
  assert.ok(result.distanceKm !== null)
  assert.ok(result.distanceKm > 680 && result.distanceKm < 710, String(result.distanceKm))
  assert.equal(result.stopsWithoutCoordinates, 0)
})

test('stops without coordinates are skipped and counted', () => {
  const result = recap({
    stops: [stops[0]!, { ...stops[1]!, lat: null, lng: null }, stops[2]!],
  })
  assert.equal(result.stopsWithoutCoordinates, 1)
  // Straight from Alderport to Corvel ≈ 502 km.
  assert.ok(result.distanceKm !== null && result.distanceKm > 490 && result.distanceKm < 515)
})

test('a recap without coordinates skips the distance', () => {
  const result = recap({ stops: stops.map((stop) => ({ ...stop, lat: null, lng: null })) })
  assert.equal(result.distanceKm, null)
  assert.equal(result.stopsWithoutCoordinates, 3)
})

test('nights separate hotels from overnight transport', () => {
  const events: TripEvent[] = [
    event('hotel', {
      kind: 'lodging',
      starts: at('2026-03-01T15:00:00'),
      ends: at('2026-03-03T11:00:00'),
    }),
    event('sleeper', {
      kind: 'train',
      starts: at('2026-03-03T22:00:00'),
      ends: at('2026-03-04T08:00:00'),
    }),
    event('red-eye', {
      kind: 'flight',
      starts: at('2026-03-04T23:30:00'),
      ends: at('2026-03-05T07:00:00'),
    }),
    event('day-train', {
      kind: 'train',
      starts: at('2026-03-02T09:00:00'),
      ends: at('2026-03-02T12:00:00'),
    }),
  ]
  const result = recap({ events })
  assert.deepEqual(result.nightsByKind, { hotel: 2, train: 1, plane: 1, other: 0, uncovered: 0 })
  assert.deepEqual(result.transport, { flights: 1, trains: 2, ferries: 0 })
})

test('transport counts legs and ignores cancelled plans', () => {
  const events: TripEvent[] = [
    event('connection', {
      kind: 'flight',
      starts: at('2026-03-01T08:00:00'),
      segments: [
        {
          id: 's1',
          position: 0,
          departs: at('2026-03-01T08:00:00'),
          arrives: at('2026-03-01T09:00:00'),
        },
        {
          id: 's2',
          position: 1,
          departs: at('2026-03-01T10:00:00'),
          arrives: at('2026-03-01T11:00:00'),
        },
      ],
    }),
    event('boat', { kind: 'ferry', starts: at('2026-03-02T08:00:00') }),
    event('dropped', { kind: 'ferry', status: 'cancelled', starts: at('2026-03-03T08:00:00') }),
  ]
  assert.deepEqual(recap({ events }).transport, { flights: 2, trains: 0, ferries: 1 })
})

test('settlements never count in the recap', () => {
  const result = recap({
    expenses: [
      expense('dinner', 4_000),
      expense('payback', 2_000, { kind: 'settlement', categoryId: 'other' }),
    ],
  })
  assert.equal(result.spending.totalMinor, 4_000n)
  assert.equal(result.spending.settlementCount, 1)
  assert.deepEqual(
    result.spending.byCategory.map((row) => row.categoryId),
    ['food']
  )
  assert.equal(result.spending.biggest?.id, 'dinner')
})

test('pending fx expenses are excluded and counted', () => {
  const result = recap({
    expenses: [
      expense('museum', 2_500),
      expense('market', null, { currency: 'MAD', amountMinor: 9_000 }),
    ],
  })
  assert.equal(result.spending.totalMinor, 2_500n)
  assert.equal(result.spending.pendingFxCount, 1)
})

test('the biggest expense ignores refunds', () => {
  const result = recap({
    expenses: [
      expense('refund', -9_000, { amountMinor: -9_000 }),
      expense('train', 3_000, { categoryId: 'transport' }),
      expense('lunch', 1_200),
    ],
  })
  assert.equal(result.spending.biggest?.id, 'train')
  assert.equal(result.spending.biggest?.baseAmountMinor, 3_000n)
  assert.equal(result.spending.totalMinor, -4_800n)
})

test('spending per day, by category, against the budget and the top local currency', () => {
  const result = recap({
    expenses: [
      expense('hotel', 30_000, { categoryId: 'accommodation' }),
      expense('tapas', 5_000, { currency: 'GBP', amountMinor: 4_300 }),
      expense('tea', 1_000, { currency: 'MAD', amountMinor: 10_800 }),
      expense('bag', 4_000, { categoryId: null, currency: 'GBP', amountMinor: 3_400 }),
    ],
  })
  assert.equal(result.spending.totalMinor, 40_000n)
  assert.equal(result.spending.perDayMinor, 8_000n)
  assert.deepEqual(
    result.spending.byCategory.map((row) => [row.categoryId, row.spentMinor]),
    [
      ['accommodation', 30_000n],
      ['food', 6_000n],
      [null, 4_000n],
    ]
  )
  assert.equal(result.spending.budgetMinor, 100_000n)
  assert.equal(result.spending.budgetLeftMinor, 60_000n)
  assert.equal(result.spending.topLocalCurrency, 'GBP')
})

test('an unfinished trip is a recap so far', () => {
  const result = recap({ today: '2026-03-03', expenses: [expense('dinner', 3_000)] })
  assert.equal(result.phase, 'ongoing')
  assert.equal(result.finished, false)
  assert.equal(result.daysSoFar, 3)
  assert.equal(result.spending.perDayMinor, 1_000n)
})

test('an empty trip says so', () => {
  const result = recap({ stops: [], trip: { ...trip, budgetTotalMinor: null } })
  assert.equal(result.empty, true)
  assert.equal(result.distanceKm, null)
  assert.equal(result.spending.biggest, null)
  assert.equal(result.spending.topLocalCurrency, null)
  assert.equal(result.spending.budgetLeftMinor, null)
})
