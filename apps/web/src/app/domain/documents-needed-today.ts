import type { DocumentTag, EventKind } from '@monkitrips/shared'

/**
 * The documents Today must show (WP 2.4): those tagged `print` or
 * `show_on_phone` whose event starts today, and on a day with a flight
 * every document tagged `requires_passport`. Each comes with the tags that
 * made it needed, in tag order. Same rules as the API's Today view. Pure.
 */
export interface NeededDocumentInput {
  id: string
  eventId: string | null
  tags: readonly DocumentTag[]
}

export interface NeededEventInput {
  id: string
  startsOn: string | null
  kind: EventKind
}

export interface NeededDocument<D extends NeededDocumentInput> {
  document: D
  reasons: DocumentTag[]
}

export function documentsNeededToday<D extends NeededDocumentInput>(
  documents: readonly D[],
  events: readonly NeededEventInput[],
  today: string
): NeededDocument<D>[] {
  const eventsToday = events.filter((event) => event.startsOn === today)
  const idsToday = new Set(eventsToday.map((event) => event.id))
  const flightDay = eventsToday.some((event) => event.kind === 'flight')
  return documents.flatMap((document) => {
    const linkedToday = document.eventId !== null && idsToday.has(document.eventId)
    const reasons = document.tags.filter((tag) =>
      tag === 'requires_passport' ? flightDay : linkedToday
    )
    return reasons.length > 0 ? [{ document, reasons }] : []
  })
}
