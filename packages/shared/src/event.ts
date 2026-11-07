/**
 * Itinerary events on the wire. The entity shape and its enums
 * (`TripEvent`, `EventSegment`, `EVENT_KINDS`, `EVENT_STATUSES`,
 * `TRANSPORT_KINDS`) live in `domain/trip_event.ts`; this module adds only
 * what the API stores and returns on top of them: the row's columns as
 * `events` and `event_segments` hold them, and the seats.
 */
import type { IsoDate } from './domain/iso_date.ts'
import type { EventSegment, TripEvent } from './domain/trip_event.ts'
import type { IsoInstant, IsoLocalDateTime } from './domain/zoned_instant.ts'

/**
 * The fields an event row shares with the domain's `TripEvent`, always
 * present on the wire (null when empty). The domain's resolved instants and
 * nested segments are replaced by the stored columns; `phone` has no column.
 */
type TripEventRowFields = Required<
  Omit<TripEvent, 'starts' | 'ends' | 'segments' | 'costMinor' | 'phone'>
>

/**
 * An event as the API returns it. Local times are `YYYY-MM-DDTHH:mm:ss`
 * without a zone next to their IANA zone; the `*At` instants are derived on
 * the server and never accepted from the client.
 */
export interface TripEventRow extends TripEventRowFields {
  tripId: string
  startsLocal: IsoLocalDateTime | null
  startTz: string | null
  startsAt: IsoInstant | null
  /** Local start date, the day the event belongs to. */
  startsOn: IsoDate | null
  endsLocal: IsoLocalDateTime | null
  endTz: string | null
  endsAt: IsoInstant | null
  lat: number | null
  lng: number | null
  providerName: string | null
  bookingCode: string | null
  /** Integer minor units of `costCurrency`, a JSON number on the wire (a `MinorUnits` for the domain). */
  costMinor: number | null
  notes: string | null
  deletedAt: IsoInstant | null
  updatedAt: IsoInstant
}

/** The fields a segment row shares with the domain's `EventSegment`, always present on the wire. */
type EventSegmentRowFields = Required<Omit<EventSegment, 'departs' | 'arrives'>>

/** One leg of a transport event as the API returns it. Present segments derive the event's start and end. */
export interface EventSegmentRow extends EventSegmentRowFields {
  tripId: string
  eventId: string
  originLat: number | null
  originLng: number | null
  destLat: number | null
  destLng: number | null
  departsLocal: IsoLocalDateTime
  departsTz: string
  departsAt: IsoInstant
  arrivesLocal: IsoLocalDateTime
  arrivesTz: string
  arrivesAt: IsoInstant
  deletedAt: IsoInstant | null
  updatedAt: IsoInstant
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
