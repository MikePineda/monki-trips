/**
 * Documents of a trip on the wire: an uploaded file (ticket, voucher, a PDF
 * to print) or a link. The entity shape and its tags (`TripDocument`,
 * `DOCUMENT_TAGS`) live in `domain/trip_document.ts`; `DOCUMENT_KINDS`
 * mirrors the CHECK constraint on `documents.kind`.
 */
import type { TripDocument } from './domain/trip_document.ts'
import type { IsoInstant } from './domain/zoned_instant.ts'

export const DOCUMENT_KINDS = ['file', 'link'] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/**
 * Document metadata as the API returns it: the domain's `TripDocument` with
 * every field present plus the stored columns. The bytes never travel
 * through sync: a file is uploaded with `POST /trips/:tripId/documents` and
 * fetched through `GET /trips/:tripId/documents/:id/file`.
 */
export interface TripDocumentRow extends Required<TripDocument> {
  tripId: string
  kind: DocumentKind
  url: string | null
  mime: string | null
  sizeBytes: number | null
  sha256: string | null
  uploadedBy: string | null
  updatedAt: IsoInstant
}
