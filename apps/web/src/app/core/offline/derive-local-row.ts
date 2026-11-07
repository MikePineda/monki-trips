import type { EventSegmentRow, TripEventRow } from '@monkitrips/shared'
import { localDateOf, localToInstant } from '../../domain/zoned-time'
import type { EventRecord, SegmentRecord } from './records'

/**
 * The derived columns the server recomputes after every merge (`startsAt`,
 * `startsOn`, `endsAt`, `departsAt`, `arrivesAt`), computed on the device
 * for the optimistic row so the itinerary places it at once. The server's
 * answer replaces these values when the mutation settles. Pure.
 */

/** A nonexistent local time (a daylight-saving gap) derives to null: the server will reject it. */
export function deriveEventInstants(
  event: Pick<TripEventRow, 'startsLocal' | 'startTz' | 'endsLocal' | 'endTz'>
): Pick<TripEventRow, 'startsAt' | 'startsOn' | 'endsAt'> {
  const startsAt =
    event.startsLocal && event.startTz ? localToInstant(event.startsLocal, event.startTz) : null
  const endTz = event.endTz ?? event.startTz
  const endsAt = event.endsLocal && endTz ? localToInstant(event.endsLocal, endTz) : null
  return {
    startsAt,
    startsOn: event.startsLocal && startsAt ? localDateOf(event.startsLocal) : null,
    endsAt,
  }
}

export function deriveSegmentInstants(
  segment: Pick<EventSegmentRow, 'departsLocal' | 'departsTz' | 'arrivesLocal' | 'arrivesTz'>
): Pick<EventSegmentRow, 'departsAt' | 'arrivesAt'> {
  return {
    departsAt: localToInstant(segment.departsLocal, segment.departsTz) ?? '',
    arrivesAt: localToInstant(segment.arrivesLocal, segment.arrivesTz) ?? '',
  }
}

/** An event with live segments starts with the first leg and ends with the last. */
export function eventFromSegments(event: EventRecord, segments: SegmentRecord[]): EventRecord {
  if (segments.length === 0) {
    return { ...event, ...deriveEventInstants(event) }
  }
  const legs = [...segments].sort((a, b) => a.position - b.position)
  const first = legs[0]
  const last = legs[legs.length - 1]
  return {
    ...event,
    startsLocal: first.departsLocal,
    startTz: first.departsTz,
    startsAt: first.departsAt || null,
    startsOn: first.departsAt ? localDateOf(first.departsLocal) : null,
    endsLocal: last.arrivesLocal,
    endTz: last.arrivesTz,
    endsAt: last.arrivesAt || null,
  }
}
