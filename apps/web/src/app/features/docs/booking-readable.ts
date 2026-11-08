import type { TripDocumentRow } from '@monkitrips/shared'

/**
 * Whether a document can be read as a booking: a file whose type is a PDF
 * or an image (the server tells a scanned PDF or an unsupported image
 * apart and answers why). Links and other files are not offered, and
 * images only while the server can read photos (`visionEnabled`): a PDF
 * with a text layer reads without vision. Pure.
 */
export function readableAsBooking(
  document: Pick<TripDocumentRow, 'kind' | 'mime'> | null | undefined,
  visionEnabled = true
): boolean {
  if (!document || document.kind !== 'file' || !document.mime) {
    return false
  }
  return (
    document.mime === 'application/pdf' || (visionEnabled && document.mime.startsWith('image/'))
  )
}
