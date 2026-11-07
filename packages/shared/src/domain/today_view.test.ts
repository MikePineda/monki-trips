import { test } from 'node:test'
import assert from 'node:assert/strict'
import { todayView, tomorrowOf, type TodayViewInput } from './today_view.ts'
import type { TripDocument } from './trip_document.ts'
import type { TripEvent } from './trip_event.ts'
import { zonedFromLocal } from './zoned_instant.ts'

// Synthetic loop: home at −300, first stop at +540 ("Harbour City"), second at +60 ("Old Town").
const trip = {
  startsOn: '2026-01-10',
  endsOn: '2026-01-21',
  homeTz: 'Home/Zone',
  homeOffsetMin: -300,
  baseCurrency: 'AUD',
  budgetTotalMinor: 120_000n,
}

const stops = [
  {
    id: 'stop-harbour',
    position: 1,
    name: 'Harbour City',
    countryCode: 'XA',
    tz: 'Harbour/Zone',
    arriveOn: '2026-01-11',
    departOn: '2026-01-15',
    offsetMin: 540,
  },
  {
    id: 'stop-old-town',
    position: 2,
    name: 'Old Town',
    countryCode: 'XB',
    tz: 'OldTown/Zone',
    arriveOn: '2026-01-16',
    departOn: '2026-01-20',
    offsetMin: 60,
  },
]

function event(partial: Partial<TripEvent> & Pick<TripEvent, 'id' | 'kind' | 'starts'>): TripEvent {
  return { status: 'booked', title: partial.id, ends: null, ...partial }
}

const hotel = event({
  id: 'hotel-harbour',
  kind: 'lodging',
  title: 'Harbour Inn',
  placeName: 'Harbour Inn',
  address: '1 Quay Road',
  addressLocal: '码头路 1 号',
  phone: 'ask reception',
  starts: zonedFromLocal('2026-01-11T15:00', 540, 'Harbour/Zone'),
  ends: zonedFromLocal('2026-01-15T11:00', 540, 'Harbour/Zone'),
})

const tour = event({
  id: 'tour-market',
  kind: 'tour',
  title: 'Market tour',
  stopId: 'stop-harbour',
  starts: zonedFromLocal('2026-01-13T10:00', 540, 'Harbour/Zone'),
  ends: zonedFromLocal('2026-01-13T12:00', 540, 'Harbour/Zone'),
})

const cancelledLunch = event({
  id: 'lunch-cancelled',
  kind: 'meal',
  status: 'cancelled',
  starts: zonedFromLocal('2026-01-13T13:00', 540, 'Harbour/Zone'),
})

const dinner = event({
  id: 'dinner',
  kind: 'meal',
  title: 'Dinner by the water',
  starts: zonedFromLocal('2026-01-13T19:00', 540, 'Harbour/Zone'),
  travelMin: 25,
})

const flight = event({
  id: 'flight-hop',
  kind: 'flight',
  title: 'Hop to Old Town',
  starts: zonedFromLocal('2026-01-15T14:00', 540, 'Harbour/Zone'),
  ends: zonedFromLocal('2026-01-15T20:00', 60, 'OldTown/Zone'),
  travelMin: 40,
  segments: [
    {
      id: 'hop-1',
      position: 1,
      originCode: 'HBR',
      destinationCode: 'MDW',
      departs: zonedFromLocal('2026-01-15T14:00', 540, 'Harbour/Zone'),
      arrives: zonedFromLocal('2026-01-15T16:30', 540, 'Harbour/Zone'),
    },
    {
      id: 'hop-2',
      position: 2,
      originCode: 'MDW',
      destinationCode: 'OLD',
      departs: zonedFromLocal('2026-01-15T18:00', 540, 'Harbour/Zone'),
      arrives: zonedFromLocal('2026-01-15T20:00', 60, 'OldTown/Zone'),
    },
  ],
})

const documents: TripDocument[] = [
  {
    id: 'doc-tour',
    eventId: 'tour-market',
    title: 'Tour voucher',
    tags: ['print'],
    availableOffline: true,
  },
  {
    id: 'doc-flight',
    eventId: 'flight-hop',
    title: 'Boarding pass',
    tags: ['show_on_phone'],
    availableOffline: false,
  },
  {
    id: 'doc-passport',
    eventId: null,
    title: 'Passport scan',
    tags: ['requires_passport'],
    availableOffline: true,
  },
  {
    id: 'doc-insurance',
    eventId: null,
    title: 'Insurance',
    tags: ['show_on_phone'],
    availableOffline: true,
  },
]

const base: TodayViewInput = {
  trip,
  stops,
  events: [hotel, tour, cancelledLunch, dinner, flight],
  documents,
  expenses: [],
  now: '2026-01-13T03:30:00Z', // 12:30 in Harbour City
}

test('today follows the stop time zone', () => {
  const view = todayView(base)
  assert.equal(view.today, '2026-01-13')
  assert.equal(view.tz, 'Harbour/Zone')
  assert.equal(view.zoneSource, 'stop')
  assert.equal(view.stop?.name, 'Harbour City')
  assert.equal(view.dayNumber, 4)
  assert.equal(view.totalDays, 12)
  // Read at home it would still be the 12th.
  assert.equal(todayView({ ...base, stops: [] }).today, '2026-01-13')
  assert.equal(todayView({ ...base, stops: [], events: [] }).today, '2026-01-12')
})

test('between stops the zone of the last started event applies, then home', () => {
  // The 15th evening, after the hop has landed: Old Town's zone, before its stop starts.
  const landed = todayView({ ...base, now: '2026-01-15T20:30:00Z' })
  assert.equal(landed.zoneSource, 'event')
  assert.equal(landed.tz, 'OldTown/Zone')
  assert.equal(landed.today, '2026-01-15')
  // Mid-flight the departure zone still applies.
  const inFlight = todayView({ ...base, now: '2026-01-15T07:00:00Z' })
  assert.equal(inFlight.tz, 'Harbour/Zone')
  // Before anything started, home.
  const atHome = todayView({ ...base, now: '2026-01-02T12:00:00Z' })
  assert.equal(atHome.zoneSource, 'home')
  assert.equal(atHome.tz, 'Home/Zone')
  assert.equal(atHome.phase, 'upcoming')
  assert.equal(atHome.dayNumber, null)
})

test('next event skips cancelled', () => {
  const view = todayView(base)
  assert.equal(view.nextEvent?.eventId, 'dinner')
  assert.equal(view.nextEvent?.startsLocal, '2026-01-13T19:00')
  assert.equal(view.nextEvent?.countdownMs, 6.5 * 3_600_000)
})

test('leave at subtracts kind buffer and travel time', () => {
  // Dinner: 15 min default buffer + 25 min travel → 18:20 local.
  const view = todayView(base)
  assert.equal(view.nextEvent?.leaveAtLocal, '2026-01-13T18:20')
  assert.equal(view.nextEvent?.leaveBufferMin, 15)
  assert.equal(view.nextEvent?.travelMin, 25)
  // The flight: 150 min default + 40 min travel → 10:50 local, with its first segment and route.
  const flightDay = todayView({ ...base, now: '2026-01-14T23:00:00Z' })
  assert.equal(flightDay.nextEvent?.eventId, 'flight-hop')
  assert.equal(flightDay.nextEvent?.segmentId, 'hop-1')
  assert.equal(flightDay.nextEvent?.leaveAtLocal, '2026-01-15T10:50')
  assert.deepEqual(flightDay.nextEvent?.route, { from: 'HBR', to: 'MDW' })
  // After the first leg departs, the second leg is next.
  const layover = todayView({ ...base, now: '2026-01-15T08:00:00Z' })
  assert.equal(layover.nextEvent?.segmentId, 'hop-2')
  assert.deepEqual(layover.nextEvent?.route, { from: 'MDW', to: 'OLD' })
})

test('print document resurfaces on the event day', () => {
  const view = todayView(base)
  assert.deepEqual(
    view.documents.map((d) => [d.documentId, d.reasons]),
    [['doc-tour', ['print']]]
  )
  const dayBefore = todayView({ ...base, now: '2026-01-12T03:30:00Z' })
  assert.deepEqual(dayBefore.documents, [])
})

test('requires_passport documents show on flight days with the boarding pass', () => {
  const view = todayView({ ...base, now: '2026-01-14T23:00:00Z' })
  assert.equal(view.isFlightDay, true)
  assert.equal(view.isTransportDay, true)
  assert.deepEqual(
    view.documents.map((d) => [d.documentId, d.reasons, d.availableOffline]),
    [
      ['doc-flight', ['show_on_phone'], false],
      ['doc-passport', ['requires_passport'], true],
    ]
  )
  assert.equal(todayView(base).isFlightDay, false)
})

test("tonight's stay is the lodging covering the night, with its address for the taxi", () => {
  const view = todayView(base)
  assert.equal(view.tonight?.how, 'lodging')
  assert.equal(view.tonight?.eventId, 'hotel-harbour')
  assert.equal(view.tonight?.address, '1 Quay Road')
  assert.equal(view.tonight?.addressLocal, '码头路 1 号')
  assert.equal(view.tonight?.startsLocal, '2026-01-11T15:00')
  assert.equal(view.tonightAlert, false)
})

test('a trip night with nowhere to sleep raises the alert, the last day does not', () => {
  const noHotel = todayView({ ...base, events: [tour, dinner] })
  assert.equal(noHotel.tonight, null)
  assert.equal(noHotel.tonightAlert, true)
  const lastDay = todayView({ ...base, events: [], stops: [], now: '2026-01-21T12:00:00Z' })
  assert.equal(lastDay.today, '2026-01-21')
  assert.equal(lastDay.tonightAlert, false)
})

test('a night on a train is tonight too', () => {
  const nightTrain = event({
    id: 'night-train',
    kind: 'train',
    title: 'Night train',
    starts: zonedFromLocal('2026-01-13T22:00', 540, 'Harbour/Zone'),
    ends: zonedFromLocal('2026-01-14T07:00', 540, 'Harbour/Zone'),
  })
  const view = todayView({ ...base, events: [tour, nightTrain] })
  assert.equal(view.tonight?.how, 'transport')
  assert.equal(view.tonight?.eventId, 'night-train')
  assert.equal(view.tonightAlert, false)
})

test('left today comes from the budget of the resolved day and counts pending expenses', () => {
  const view = todayView({
    ...base,
    expenses: [
      { amountMinor: 30_000n, currency: 'AUD', baseAmountMinor: 30_000n, spentOn: '2026-01-11' },
      {
        amountMinor: 2_000n,
        currency: 'AUD',
        baseAmountMinor: 2_000n,
        spentOn: '2026-01-13',
        syncPending: true,
      },
      { amountMinor: 50_000n, currency: 'THB', baseAmountMinor: null, spentOn: '2026-01-13' },
    ],
  })
  assert.equal(view.budget.allowanceTodayMinor, 10_000n)
  assert.equal(view.budget.leftTodayMinor, 8_000n)
  assert.equal(view.budget.pendingSyncCount, 1)
  assert.equal(view.budget.pendingFxCount, 1)
})

test('cached weather passes through with its age and is null without data', () => {
  const view = todayView({
    ...base,
    weather: { updatedAt: '2026-01-13T00:30:00Z', summary: 'clear', tempMaxC: 31 },
  })
  assert.equal(view.weather?.summary, 'clear')
  assert.equal(view.weather?.ageMs, 3 * 3_600_000)
  assert.equal(todayView(base).weather, null)
  assert.equal(todayView({ ...base, weather: null }).weather, null)
})

test('departure day is flagged and an ongoing trip without stops still has a today', () => {
  const departure = todayView({ ...base, stops: [], events: [], now: '2026-01-10T12:00:00Z' })
  assert.equal(departure.today, '2026-01-10')
  assert.equal(departure.isDepartureDay, true)
  assert.equal(departure.phase, 'ongoing')
  assert.equal(departure.dayNumber, 1)
  assert.equal(departure.nextEvent, null)
  assert.equal(departure.stop, null)
  assert.equal(tomorrowOf(departure.today), '2026-01-11')
})

test('an event without end can be next and never lingers as current', () => {
  const afterDinner = todayView({ ...base, now: '2026-01-13T10:30:00Z' }) // 19:30 local
  assert.equal(afterDinner.nextEvent?.eventId, 'flight-hop')
  assert.equal(afterDinner.nextEvent?.countdownMs > 0, true)
})

test('a deleted document never shows, and a forced night event is tonight', () => {
  const carNight = event({
    id: 'sleep-in-the-car',
    kind: 'car',
    title: 'Camper night',
    starts: zonedFromLocal('2026-01-13T20:00', 540, 'Harbour/Zone'),
    coversNight: true,
  })
  const view = todayView({
    ...base,
    events: [tour, carNight],
    documents: [{ ...documents[0]!, deletedAt: '2026-01-12T00:00:00Z' }],
  })
  assert.deepEqual(view.documents, [])
  assert.equal(view.tonight?.eventId, 'sleep-in-the-car')
  assert.equal(view.tonight?.how, 'transport')
})
