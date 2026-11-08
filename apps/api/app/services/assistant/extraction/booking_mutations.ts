import {
  majorAmountToMinor,
  minorUnitExponent,
  type BookingDraft,
  type BookingSegmentDraft,
  type SyncMutation,
} from '@monkitrips/shared'
import { isValidZone, localTimeToInstant } from '#domain/local_time'
import { isTransportBooking } from '#services/assistant/extraction/booking_draft_rules'

export interface BookingMutationIds {
  tripId: string
  /** The new event's id, kept across revisions so the proposal keeps pointing at one row. */
  eventId: string
  /** The document read; accepting links it to the event. */
  documentId: string | null
  /** A fresh uuid for each mutation and each new segment. */
  newId: () => string
  changedAt: string
  /** The words of the seat note, in the member's language. */
  labels: { seats: string; coach: string }
}

/** A local time and zone the sync entity will accept, or nothing. */
function zonedTime(value: string | null, zone: string | null): [string, string] | null {
  if (value === null || zone === null || !isValidZone(zone)) return null
  return localTimeToInstant(value, zone).ok ? [value, zone] : null
}

/** A leg only travels when both its ends are known with their zones. */
function completeLeg(segment: BookingSegmentDraft): boolean {
  return (
    zonedTime(segment.departsLocal, segment.departsTz) !== null &&
    zonedTime(segment.arrivesLocal, segment.arrivesTz) !== null
  )
}

/** A title when the booking printed none: the provider, else the route, else the kind. */
function titleOf(draft: BookingDraft): string {
  if (draft.title) return draft.title
  if (draft.providerName) return draft.providerName
  const first = draft.segments[0]
  const last = draft.segments[draft.segments.length - 1]
  const from = first?.originName ?? first?.originCode
  const to = last?.destName ?? last?.destCode
  if (from && to) return `${from} → ${to}`
  return draft.kind
}

function seatNote(draft: BookingDraft, labels: BookingMutationIds['labels']): string | null {
  const lines = draft.seats
    .filter((seat) => seat.seat !== null)
    .map((seat) =>
      seat.coach ? `${seat.seat} (${labels.coach} ${seat.coach})` : String(seat.seat)
    )
  return lines.length > 0 ? `${labels.seats}: ${lines.join(', ')}` : null
}

/**
 * The sync mutations a booking draft stands for, pure: one `booked` event
 * (a lodging or tour carries its own start and end; a transport event gets
 * its times from the legs), one segment per leg whose departure and arrival
 * are both known with their zones, and, when the booking was read from a
 * document, the document linked to the event. A value that would be a guess
 * (a time without its zone, an amount without a currency) is left out
 * rather than invented; the review flags tell the member. Seat lines become
 * a note: a booking never says which traveller of the trip sits where.
 */
export function bookingMutations(draft: BookingDraft, ids: BookingMutationIds): SyncMutation[] {
  const event: Record<string, unknown> = {
    kind: draft.kind,
    title: titleOf(draft),
    status: 'booked',
  }
  const set = (field: string, value: unknown) => {
    if (value !== null && value !== undefined) event[field] = value
  }
  set('providerName', draft.providerName)
  set('bookingCode', draft.bookingCode)
  set('placeName', draft.placeName)
  set('address', draft.address)
  set('addressLocal', draft.addressLocal)
  if (!isTransportBooking(draft)) {
    const start = zonedTime(draft.startsLocal, draft.startTz)
    const end = zonedTime(draft.endsLocal, draft.endTz ?? draft.startTz)
    if (start) {
      event['startsLocal'] = start[0]
      event['startTz'] = start[1]
    }
    if (start && end) {
      event['endsLocal'] = end[0]
      event['endTz'] = end[1]
    }
  }
  if (draft.cost !== null && draft.costCurrency && minorUnitExponent(draft.costCurrency).known) {
    const minor = majorAmountToMinor(draft.cost, draft.costCurrency)
    if (minor !== null && minor <= BigInt(Number.MAX_SAFE_INTEGER)) {
      event['costMinor'] = Number(minor)
      event['costCurrency'] = draft.costCurrency
    }
  }
  set('notes', seatNote(draft, ids.labels))

  const mutation = (
    entity: SyncMutation['entity'],
    id: string,
    changes: Record<string, unknown>
  ): SyncMutation => ({
    mutationId: ids.newId(),
    tripId: ids.tripId,
    entity,
    op: 'upsert',
    id,
    changes,
    changedAt: ids.changedAt,
  })

  const mutations = [mutation('event', ids.eventId, event)]
  if (isTransportBooking(draft)) {
    let position = 0
    for (const segment of draft.segments) {
      if (!completeLeg(segment)) continue
      const changes: Record<string, unknown> = { eventId: ids.eventId, position }
      for (const [field, value] of Object.entries(segment)) {
        if (value !== null) changes[field] = value
      }
      position += 1
      const segmentId = ids.newId()
      mutations.push({ ...mutation('segment', segmentId, changes) })
    }
  }
  if (ids.documentId) mutations.push(mutation('document', ids.documentId, { eventId: ids.eventId }))
  return mutations
}
