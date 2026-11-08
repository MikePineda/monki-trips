/**
 * The recap of a trip: the numbers worth keeping once it is over (or "so
 * far" while it is under way), read from the same offline data as every
 * other screen. Pure; `today` is the caller's local date.
 *
 *   days, nights            the trip's calendar (`trip_dates`)
 *   daysSoFar               days lived: all of them once past, up to today while ongoing, 0 before
 *   countries, cities       distinct, in itinerary order (position)
 *   distanceKm              Σ great-circle(stop_i, stop_i+1) over consecutive stops that have
 *                           coordinates; a stop without them is skipped and counted; null with
 *                           fewer than two located stops
 *   nightsByKind            each night of the trip once: on board a train or a plane (a night
 *                           transport wins over a hotel booked the same night), in a lodging,
 *                           covered otherwise (a ferry, a bus, an override) or uncovered
 *   transport               active flights, trains and ferries, one per leg when the event has legs
 *   spending.totalMinor     Σ base amounts of expenses (refunds subtract)
 *   spending.perDayMinor    floor(total / daysSoFar), null before the trip
 *   spending.biggest        the largest positive base amount; refunds never win
 *   spending.topLocalCurrency  the currency other than the base with the most base spent
 *
 * Settlements (`kind: 'settlement'`, money moving between travellers) are
 * no spending: left out of every sum and counted in `settlementCount`.
 * Expenses still waiting for a rate (`baseAmountMinor: null`) are left out
 * and counted in `pendingFxCount`.
 */
import type { ExpenseKind } from '../expense.ts'
import { compareIsoDate, daysBetween, type IsoDate } from './iso_date.ts'
import { floorDiv, toMinor, type MinorUnits } from './minor_units.ts'
import { nightCoverage } from './night_coverage.ts'
import { tripPhase, tripTotalDays, type TripDates, type TripPhase } from './trip_dates.ts'
import { isActiveEvent, sortedSegments, type TripEvent } from './trip_event.ts'
import { sortedStops } from './trip_stop.ts'

/** Mean Earth radius (IUGG), kilometres. */
export const EARTH_RADIUS_KM = 6371.0088

export interface RecapTrip extends TripDates {
  baseCurrency: string
  budgetTotalMinor: MinorUnits | null
}

export interface RecapStop {
  position: number
  name: string
  countryCode: string | null
  lat: number | null
  lng: number | null
}

export interface RecapExpense {
  id: string
  /** Absent on rows written before settlements existed: an expense. */
  kind?: ExpenseKind
  categoryId: string | null
  amountMinor: MinorUnits
  currency: string
  /** Null while the expense waits for a rate. */
  baseAmountMinor: MinorUnits | null
  spentOn: IsoDate
}

export interface RecapInput {
  trip: RecapTrip
  stops: readonly RecapStop[]
  /** Events with their instants resolved (`toDomainEvents` on the web). */
  events: readonly TripEvent[]
  expenses: readonly RecapExpense[]
  today: IsoDate
}

export interface RecapNights {
  hotel: number
  train: number
  plane: number
  /** Covered by something else: a ferry, a bus, an event marked as covering the night. */
  other: number
  uncovered: number
}

export interface RecapTransport {
  flights: number
  trains: number
  ferries: number
}

export interface RecapCategory {
  /** Null for expenses without a category. */
  categoryId: string | null
  spentMinor: bigint
}

export interface RecapSpending {
  baseCurrency: string
  totalMinor: bigint
  perDayMinor: bigint | null
  /** Largest first; the uncategorised row (null) last on a tie. */
  byCategory: RecapCategory[]
  biggest: { id: string; baseAmountMinor: bigint; categoryId: string | null } | null
  budgetMinor: bigint | null
  /** `budget − total`; negative means over budget. */
  budgetLeftMinor: bigint | null
  topLocalCurrency: string | null
  /** Expenses counted (not settlements, not pending). */
  expenseCount: number
  settlementCount: number
  pendingFxCount: number
}

export interface TripRecap {
  phase: TripPhase
  /** True once the trip is over: the recap celebrates; before that it is "so far". */
  finished: boolean
  days: number
  daysSoFar: number
  nights: number
  countries: string[]
  cities: string[]
  distanceKm: number | null
  stopsWithoutCoordinates: number
  nightsByKind: RecapNights
  transport: RecapTransport
  spending: RecapSpending
  /** Nothing to recap yet: no stops, no events and no expenses. */
  empty: boolean
}

/** Great-circle distance between two points (haversine), kilometres. */
export function greatCircleKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const rad = Math.PI / 180
  const dLat = (to.lat - from.lat) * rad
  const dLng = (to.lng - from.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function located(stop: RecapStop): stop is RecapStop & { lat: number; lng: number } {
  return (
    typeof stop.lat === 'number' &&
    typeof stop.lng === 'number' &&
    Number.isFinite(stop.lat) &&
    Number.isFinite(stop.lng)
  )
}

function distance(stops: readonly RecapStop[]): { km: number | null; skipped: number } {
  const points = stops.filter(located)
  if (points.length < 2) {
    return { km: null, skipped: stops.length - points.length }
  }
  let km = 0
  for (let index = 1; index < points.length; index++) {
    km += greatCircleKm(points[index - 1]!, points[index]!)
  }
  return { km: Math.round(km), skipped: stops.length - points.length }
}

function nightsByKind(trip: TripDates, events: readonly TripEvent[]): RecapNights {
  const counts: RecapNights = { hotel: 0, train: 0, plane: 0, other: 0, uncovered: 0 }
  for (const night of nightCoverage(trip, events).nights) {
    const kinds = new Set(night.coveredBy.map((cover) => cover.kind))
    if (!night.covered) {
      counts.uncovered++
    } else if (kinds.has('train')) {
      counts.train++
    } else if (kinds.has('flight')) {
      counts.plane++
    } else if (kinds.has('lodging')) {
      counts.hotel++
    } else {
      counts.other++
    }
  }
  return counts
}

function transport(events: readonly TripEvent[]): RecapTransport {
  const counts: RecapTransport = { flights: 0, trains: 0, ferries: 0 }
  for (const event of events) {
    if (!isActiveEvent(event)) {
      continue
    }
    const legs = Math.max(1, sortedSegments(event).length)
    if (event.kind === 'flight') {
      counts.flights += legs
    } else if (event.kind === 'train') {
      counts.trains += legs
    } else if (event.kind === 'ferry') {
      counts.ferries += legs
    }
  }
  return counts
}

function spending(input: RecapInput, daysSoFar: number): RecapSpending {
  const base = input.trip.baseCurrency.toUpperCase()
  let totalMinor = 0n
  let settlementCount = 0
  let pendingFxCount = 0
  let expenseCount = 0
  const byCategory = new Map<string | null, bigint>()
  const byCurrency = new Map<string, bigint>()
  let biggest: RecapSpending['biggest'] = null
  for (const expense of input.expenses) {
    if (expense.kind === 'settlement') {
      settlementCount++
      continue
    }
    if (expense.baseAmountMinor === null) {
      pendingFxCount++
      continue
    }
    const amount = toMinor(expense.baseAmountMinor)
    expenseCount++
    totalMinor += amount
    byCategory.set(expense.categoryId, (byCategory.get(expense.categoryId) ?? 0n) + amount)
    const currency = expense.currency.toUpperCase()
    if (currency !== base) {
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0n) + amount)
    }
    if (amount > 0n && (!biggest || amount > biggest.baseAmountMinor)) {
      biggest = { id: expense.id, baseAmountMinor: amount, categoryId: expense.categoryId }
    }
  }
  const categories = [...byCategory.entries()]
    .map(([categoryId, spentMinor]) => ({ categoryId, spentMinor }))
    .filter((row) => row.spentMinor > 0n)
    .sort((a, b) =>
      a.spentMinor === b.spentMinor
        ? Number(a.categoryId === null) - Number(b.categoryId === null) ||
          (a.categoryId ?? '').localeCompare(b.categoryId ?? '')
        : a.spentMinor > b.spentMinor
          ? -1
          : 1
    )
  let topLocalCurrency: string | null = null
  let topAmount = 0n
  for (const [currency, amount] of [...byCurrency.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (amount > topAmount) {
      topLocalCurrency = currency
      topAmount = amount
    }
  }
  const budgetMinor =
    input.trip.budgetTotalMinor === null ? null : toMinor(input.trip.budgetTotalMinor)
  return {
    baseCurrency: base,
    totalMinor,
    perDayMinor: daysSoFar > 0 ? floorDiv(totalMinor, BigInt(daysSoFar)) : null,
    byCategory: categories,
    biggest,
    budgetMinor,
    budgetLeftMinor: budgetMinor === null ? null : budgetMinor - totalMinor,
    topLocalCurrency,
    expenseCount,
    settlementCount,
    pendingFxCount,
  }
}

export function tripRecap(input: RecapInput): TripRecap {
  const { trip, today } = input
  const phase = tripPhase(trip, today)
  const days = tripTotalDays(trip)
  const daysSoFar =
    phase === 'past' ? days : phase === 'ongoing' ? daysBetween(trip.startsOn, today) + 1 : 0
  const stops = sortedStops(input.stops)
  const countries: string[] = []
  const cities: string[] = []
  const seenCities = new Set<string>()
  for (const stop of stops) {
    if (stop.countryCode && !countries.includes(stop.countryCode)) {
      countries.push(stop.countryCode)
    }
    const name = stop.name.trim()
    const key = `${stop.countryCode ?? ''}:${name.toLocaleLowerCase()}`
    if (name !== '' && !seenCities.has(key)) {
      seenCities.add(key)
      cities.push(name)
    }
  }
  const route = distance(stops)
  const nights = compareIsoDate(trip.startsOn, trip.endsOn) < 0 ? days - 1 : 0
  return {
    phase,
    finished: phase === 'past',
    days,
    daysSoFar,
    nights,
    countries,
    cities,
    distanceKm: route.km,
    stopsWithoutCoordinates: route.skipped,
    nightsByKind: nightsByKind(trip, input.events),
    transport: transport(input.events),
    spending: spending(input, daysSoFar),
    empty: stops.length === 0 && input.events.length === 0 && input.expenses.length === 0,
  }
}
