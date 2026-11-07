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

/** Control characters, quotes and backslashes would break out of the quoted header value. */
function isUnsafeInHeader(char: string): boolean {
  const code = char.charCodeAt(0)
  return code < 0x20 || code === 0x7f || char === '"' || char === '\\'
}

/**
 * Images and PDFs may open in the browser; anything else downloads. The
 * name travels twice: `filename` is an ASCII fallback (quotes, controls and
 * non-ASCII replaced), `filename*` carries it whole (RFC 5987/6266, UTF-8
 * percent-encoded), which every current browser prefers.
 */
export function contentDispositionFor(mime: string | null, filename: string): string {
  const inline = mime !== null && (mime === 'application/pdf' || mime.startsWith('image/'))
  // By code point, so the cut never splits a surrogate pair (encodeURIComponent would throw).
  const name =
    Array.from(filename, (char) => (isUnsafeInHeader(char) ? '_' : char))
      .slice(0, 150)
      .join('') || 'document'
  const fallback = name.replace(/[^\u0020-\u007e]/g, '_')
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

/** The object key of a document's bytes. */
export function documentStorageKey(tripId: string, documentId: string): string {
  return `trips/${tripId}/${documentId}`
}
