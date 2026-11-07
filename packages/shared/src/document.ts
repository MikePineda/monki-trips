/**
 * Documents of a trip: an uploaded file (ticket, voucher, a PDF to print) or
 * a link. Mirrored by the CHECK constraints on `documents.kind` and
 * `documents.tags`.
 */
export const DOCUMENT_KINDS = ['file', 'link'] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/**
 * What the document is for. `print` creates a "print this" task before
 * departure; `show_on_phone` surfaces it on the event's day; the passport
 * reminder shows on flight days.
 */
export const DOCUMENT_TAGS = ['print', 'show_on_phone', 'requires_passport'] as const

export type DocumentTag = (typeof DOCUMENT_TAGS)[number]

/**
 * Document metadata as the API returns it. The bytes never travel through
 * sync: a file is uploaded with `POST /trips/:tripId/documents` and fetched
 * through `GET /trips/:tripId/documents/:id/file`.
 */
export interface TripDocument {
  id: string
  tripId: string
  eventId: string | null
  kind: DocumentKind
  title: string
  url: string | null
  mime: string | null
  sizeBytes: number | null
  sha256: string | null
  tags: DocumentTag[]
  availableOffline: boolean
  uploadedBy: string | null
  deletedAt: string | null
  updatedAt: string
}
