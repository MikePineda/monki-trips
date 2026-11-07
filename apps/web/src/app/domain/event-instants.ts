import type {
  EventSegment,
  EventSegmentRow,
  TripEvent,
  TripEventRow,
  ZonedInstant,
} from '@monkitrips/shared'
import { zonedInstant } from './zoned-time'

/**
 * The stored rows as the domain pipelines read them (`night_coverage`,
 * `today_view`): instants resolved to `ZonedInstant` with the zone's
 * offset, segments nested under their event. An event with no start
 * cannot be placed and is left out. Pure.
 */
/** The stored rows, with or without the tombstone column (the device keeps them without). */
export type EventRow = Omit<TripEventRow, 'deletedAt'>
export type SegmentRow = Omit<EventSegmentRow, 'deletedAt'>

export function toDomainEvent(
  event: EventRow,
  segments: readonly SegmentRow[] = []
): TripEvent | null {
  const starts = zoned(event.startsAt, event.startTz)
  if (!starts) {
    return null
  }
  const legs = segments
    .filter((segment) => segment.eventId === event.id)
    .map(toDomainSegment)
    .filter((segment): segment is EventSegment => segment !== null)
  return {
    id: event.id,
    kind: event.kind,
    status: event.status,
    title: event.title,
    stopId: event.stopId,
    starts,
    ends: zoned(event.endsAt, event.endTz ?? event.startTz),
    coversNight: event.coversNight,
    leaveBufferMin: event.leaveBufferMin,
    travelMin: event.travelMin,
    placeName: event.placeName,
    address: event.address,
    addressLocal: event.addressLocal,
    costMinor: event.costMinor,
    costCurrency: event.costCurrency,
    ...(legs.length > 0 ? { segments: legs } : {}),
  }
}

export function toDomainEvents(
  events: readonly EventRow[],
  segments: readonly SegmentRow[] = []
): TripEvent[] {
  return events
    .map((event) => toDomainEvent(event, segments))
    .filter((event): event is TripEvent => event !== null)
}

function toDomainSegment(segment: SegmentRow): EventSegment | null {
  const departs = zoned(segment.departsAt, segment.departsTz)
  if (!departs) {
    return null
  }
  return {
    id: segment.id,
    position: segment.position,
    carrier: segment.carrier,
    number: segment.number,
    originCode: segment.originCode,
    originName: segment.originName,
    destCode: segment.destCode,
    destName: segment.destName,
    departs,
    arrives: zoned(segment.arrivesAt, segment.arrivesTz),
  }
}

function zoned(at: string | null, zone: string | null): ZonedInstant | null {
  if (!at || !zone) {
    return null
  }
  try {
    return zonedInstant(at, zone)
  } catch {
    return null
  }
}
