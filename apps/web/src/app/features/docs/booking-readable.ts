import type { TripDocumentRow } from '@monkitrips/shared'

/**
 * Whether a document can be read as a booking: a file whose type is a PDF
 * or an image (the server tells a scanned PDF or an unsupported image
 * apart and answers why). Links and other files are not offered. Pure.
 */
export function readableAsBooking(
  document: Pick<TripDocumentRow, 'kind' | 'mime'> | null | undefined
): boolean {
  if (!document || document.kind !== 'file' || !document.mime) {
    return false
  }
  return document.mime === 'application/pdf' || document.mime.startsWith('image/')
}
