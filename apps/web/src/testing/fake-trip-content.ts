import type {
  EventSegmentRow,
  Expense,
  SegmentSeat,
  Trip,
  TripDocumentRow,
  TripEventRow,
  TripStopRow,
} from '@monkitrips/shared'
import type { TripRecord } from '../app/core/offline/records'
import { documentRow } from './fake-documents-api'

/**
 * Synthetic trip content for specs: invented places, codes and prices.
 * Every builder gives a full wire row with nulls, then the overrides.
 */
export const DEMO_TRIP_ID = 'trip-1'

export const DEMO_TRIP_RECORD: TripRecord = {
  id: DEMO_TRIP_ID,
  name: 'Harbour and hills',
  startDate: '2027-01-20',
  endDate: '2027-01-24',
  baseCurrency: 'AUD',
  budgetMode: 'shared',
  budgetTotalMinor: null,
  homeTz: 'Australia/Sydney',
  role: 'owner',
  updatedAt: '2026-11-07T00:00:00.000Z',
}

export function demoTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: DEMO_TRIP_ID,
    name: 'Harbour and hills',
    baseCurrency: 'AUD',
    budgetMode: 'shared',
    budgetTotalMinor: null,
    startsOn: '2027-01-20',
    endsOn: '2027-01-24',
    homeTz: 'Australia/Sydney',
    createdBy: 'local-traveller',
    deletedAt: null,
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

export function blankStop(overrides: Partial<TripStopRow> = {}): TripStopRow {
  return {
    id: 'stop-1',
    tripId: DEMO_TRIP_ID,
    position: 0,
    name: 'Port Vellmar',
    countryCode: 'XA',
    lat: null,
    lng: null,
    tz: 'Asia/Bangkok',
    arriveOn: '2027-01-20',
    departOn: '2027-01-24',
    deletedAt: null,
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

export function blankEvent(overrides: Partial<TripEventRow> = {}): TripEventRow {
  return {
    id: 'event-1',
    tripId: DEMO_TRIP_ID,
    stopId: null,
    kind: 'other',
    title: 'Untitled',
    status: 'booked',
    startsLocal: null,
    startTz: null,
    startsAt: null,
    startsOn: null,
    endsLocal: null,
    endTz: null,
    endsAt: null,
    placeName: null,
    address: null,
    addressLocal: null,
    lat: null,
    lng: null,
    providerName: null,
    bookingCode: null,
    costMinor: null,
    costCurrency: null,
    notes: null,
    leaveBufferMin: null,
    travelMin: null,
    coversNight: null,
    deletedAt: null,
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

/** An event placed at a local time in a zone, with its instants derived like the server does. */
export function placedEvent(
  startsLocal: string,
  zone: string,
  overrides: Partial<TripEventRow> = {}
): TripEventRow {
  const endsLocal = overrides.endsLocal ?? null
  const endTz = overrides.endTz ?? zone
  return blankEvent({
    startsLocal,
    startTz: zone,
    startsAt: instant(startsLocal, zone),
    startsOn: startsLocal.slice(0, 10),
    endsLocal,
    endTz: endsLocal ? endTz : null,
    endsAt: endsLocal ? instant(endsLocal, endTz) : null,
    ...overrides,
  })
}

export function blankSegment(overrides: Partial<EventSegmentRow> = {}): EventSegmentRow {
  const departsLocal = overrides.departsLocal ?? '2027-01-20T09:30'
  const departsTz = overrides.departsTz ?? 'Asia/Bangkok'
  const arrivesLocal = overrides.arrivesLocal ?? '2027-01-20T11:00'
  const arrivesTz = overrides.arrivesTz ?? 'Asia/Bangkok'
  return {
    id: 'segment-1',
    tripId: DEMO_TRIP_ID,
    eventId: 'event-1',
    position: 1,
    carrier: 'Demo Air',
    number: 'DA 101',
    originCode: 'PVM',
    originName: 'Port Vellmar',
    originLat: null,
    originLng: null,
    destCode: 'ALD',
    destName: 'Aldermoor',
    destLat: null,
    destLng: null,
    departsLocal,
    departsTz,
    departsAt: instant(departsLocal, departsTz),
    arrivesLocal,
    arrivesTz,
    arrivesAt: instant(arrivesLocal, arrivesTz),
    deletedAt: null,
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

export function blankSeat(overrides: Partial<SegmentSeat> = {}): SegmentSeat {
  return {
    id: 'seat-1',
    tripId: DEMO_TRIP_ID,
    segmentId: 'segment-1',
    travellerId: 'traveller-1',
    seat: '12A',
    coach: null,
    ticketNumber: null,
    documentId: null,
    deletedAt: null,
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

/** A file document of the demo trip with a made-up server hash: the documents builder, filled in. */
export function blankDocument(overrides: Partial<TripDocumentRow> = {}): TripDocumentRow {
  return documentRow({
    tripId: DEMO_TRIP_ID,
    title: 'Ferry ticket',
    sizeBytes: 1024,
    sha256: 'a'.repeat(64),
    availableOffline: true,
    ...overrides,
  })
}

/** An expense of the demo trip, already converted to the base currency. */
export function blankExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    tripId: DEMO_TRIP_ID,
    categoryId: null,
    eventId: null,
    amountMinor: 1250,
    currency: 'AUD',
    fxRate: '1',
    fxRateDate: '2027-01-20',
    fxSource: 'identity',
    baseAmountMinor: 1250,
    spentOn: '2027-01-20',
    description: 'Synthetic lunch',
    paidByTravellerId: null,
    needsDetails: false,
    createdBy: 'local-traveller',
    deletedAt: null,
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

/** The instant of a local time in a zone, with the offsets the fixtures use (no DST in them). */
function instant(local: string, zone: string): string {
  const offsets: Record<string, number> = {
    'Asia/Bangkok': 420,
    'Asia/Tokyo': 540,
    'Australia/Sydney': 660,
    'Europe/Athens': 120,
    'UTC': 0,
  }
  const offset = offsets[zone]
  if (offset === undefined) {
    throw new Error(`fixture zone without a fixed offset: ${zone}`)
  }
  const [date, time] = local.split('T')
  return new Date(
    Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`) - offset * 60_000
  ).toISOString()
}
