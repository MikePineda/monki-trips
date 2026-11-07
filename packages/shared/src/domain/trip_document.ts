/**
 * A document of the trip (a ticket, a voucher, a link) as the domain reads
 * it: the row of `documents` reduced to what Today, the print tasks and the
 * mascot need. Tags are the CHECK set of `documents.tags`.
 */
import type { IsoInstant } from './zoned_instant.ts'

export const DOCUMENT_TAGS = ['print', 'show_on_phone', 'requires_passport'] as const

export type DocumentTag = (typeof DOCUMENT_TAGS)[number]

export interface TripDocument {
  id: string
  /** The event this document belongs to, or null for a trip-wide document. */
  eventId: string | null
  title: string
  tags: readonly DocumentTag[]
  /** True when the device holds a verified copy of the file. */
  availableOffline: boolean
  deletedAt?: IsoInstant | null
}

export function hasTag(document: Pick<TripDocument, 'tags'>, tag: DocumentTag): boolean {
  return document.tags.includes(tag)
}
