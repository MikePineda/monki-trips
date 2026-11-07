/**
 * Itinerary events, mirrored by the CHECK constraints on `events.kind` and
 * `events.status`. A hotel stay is one `lodging` event from check-in to
 * check-out; transport kinds may carry segments that derive the event's
 * start and end.
 */
export const EVENT_KINDS = [
  'flight',
  'train',
  'ferry',
  'bus',
  'car',
  'lodging',
  'tour',
  'meal',
  'activity',
  'free_time',
  'other',
] as const

export type EventKind = (typeof EVENT_KINDS)[number]

export const EVENT_STATUSES = ['idea', 'to_book', 'booked', 'paid', 'cancelled'] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

/** Kinds that move people and can cover a night (an overnight train, a red-eye flight). */
export const TRANSPORT_KINDS = ['flight', 'train', 'ferry', 'bus', 'car'] as const

export type TransportKind = (typeof TRANSPORT_KINDS)[number]

/**
 * An event as the API returns it. Local times are `YYYY-MM-DDTHH:mm:ss`
 * without a zone next to their IANA zone; the `*At` instants are derived on
 * the server and never accepted from the client. Money is integer minor
 * units of `costCurrency`.
 */
export interface TripEvent {
  id: string
  tripId: string
  stopId: string | null
  kind: EventKind
  title: string
  status: EventStatus
  startsLocal: string | null
  startTz: string | null
  startsAt: string | null
  /** Local start date, the day the event belongs to. */
  startsOn: string | null
  endsLocal: string | null
  endTz: string | null
  endsAt: string | null
  placeName: string | null
  address: string | null
  addressLocal: string | null
  lat: number | null
  lng: number | null
  providerName: string | null
  bookingCode: string | null
  costMinor: number | null
  costCurrency: string | null
  notes: string | null
  leaveBufferMin: number | null
  travelMin: number | null
  /** Forces the night coverage: true covers, false never covers, null lets the rules decide. */
  coversNight: boolean | null
  deletedAt: string | null
  updatedAt: string
}

/** One leg of a transport event. Present segments derive the event's start and end. */
export interface EventSegment {
  id: string
  tripId: string
  eventId: string
  position: number
  carrier: string | null
  number: string | null
  originName: string | null
  originCode: string | null
  originLat: number | null
  originLng: number | null
  destName: string | null
  destCode: string | null
  destLat: number | null
  destLng: number | null
  departsLocal: string
  departsTz: string
  departsAt: string
  arrivesLocal: string
  arrivesTz: string
  arrivesAt: string
  deletedAt: string | null
  updatedAt: string
}

/** A traveller's seat on one segment. */
export interface SegmentSeat {
  id: string
  tripId: string
  segmentId: string
  travellerId: string
  seat: string | null
  coach: string | null
  ticketNumber: string | null
  documentId: string | null
  deletedAt: string | null
  updatedAt: string
}
