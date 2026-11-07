/**
 * Which uploaded files a trip accepts and how they are served. The type is
 * decided from the bytes (magic numbers), never from the name or the
 * declared content type: a renamed executable is refused whatever it claims.
 */

/** 25 MB, the limit of a single document. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

/** MIME types a document may have, as the sniffer reports them. */
export const ALLOWED_DOCUMENT_MIMES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

export function isAllowedDocumentMime(mime: string | undefined): mime is string {
  return mime !== undefined && ALLOWED_DOCUMENT_MIMES.has(mime)
}

/** Images and PDFs may open in the browser; anything else downloads. */
export function contentDispositionFor(mime: string | null, filename: string): string {
  const inline = mime !== null && (mime === 'application/pdf' || mime.startsWith('image/'))
  const safeName = filename.replace(/["\\\r\n]/g, '_').slice(0, 150) || 'document'
  return `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`
}

/** The object key of a document's bytes. */
export function documentStorageKey(tripId: string, documentId: string): string {
  return `trips/${tripId}/${documentId}`
}
