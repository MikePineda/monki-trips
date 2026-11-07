/**
 * The Docs tab lists documents by when they matter, relative to the event
 * each one is linked to: `today` (the event starts today), `upcoming` (it
 * starts later), `other` (it started already, has no date, is gone, or the
 * document is trip-wide). Inside a group the event's date orders the rows,
 * then the title. Pure.
 */
export type DocumentWhen = 'today' | 'upcoming' | 'other'

export const DOCUMENT_WHENS: readonly DocumentWhen[] = ['today', 'upcoming', 'other']

export interface GroupableDocument {
  id: string
  eventId: string | null
  title: string
}

export interface GroupableEvent {
  id: string
  /** The local start date, null for an event without a time. */
  startsOn: string | null
  title: string
}

export interface DocumentGroup<D extends GroupableDocument> {
  when: DocumentWhen
  documents: D[]
}

export function groupDocumentsByWhen<D extends GroupableDocument>(
  documents: readonly D[],
  events: readonly GroupableEvent[],
  today: string
): DocumentGroup<D>[] {
  const byId = new Map(events.map((event) => [event.id, event]))
  const whenOf = (document: D): DocumentWhen => {
    const startsOn = document.eventId ? byId.get(document.eventId)?.startsOn : null
    if (!startsOn || startsOn < today) {
      return 'other'
    }
    return startsOn === today ? 'today' : 'upcoming'
  }
  const dateOf = (document: D) =>
    (document.eventId ? byId.get(document.eventId)?.startsOn : null) ?? ''
  return DOCUMENT_WHENS.map((when) => ({
    when,
    documents: documents
      .filter((document) => whenOf(document) === when)
      .sort(
        (a, b) =>
          dateOf(a).localeCompare(dateOf(b)) ||
          a.title.localeCompare(b.title) ||
          a.id.localeCompare(b.id)
      ),
  })).filter((group) => group.documents.length > 0)
}
