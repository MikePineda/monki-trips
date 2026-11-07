import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import type { DocumentTag, TripDocumentRow } from '@monkitrips/shared'
import { RealDocumentsApi } from './real-documents-api'

export interface UploadDocumentInput {
  tripId: string
  /** The client's UUID for the new document (the server answers 200 on a repeat). */
  id: string
  file: Blob
  /** The file name sent with the bytes (the server falls back to it for the title). */
  fileName: string
  title: string
  tags: readonly DocumentTag[]
  eventId: string | null
}

/**
 * The bytes of documents: upload creates a `file` document
 * (`POST /trips/:tripId/documents`, multipart), download follows the 302
 * of `GET /trips/:tripId/documents/:id/file` to its short signed URL.
 * Metadata never goes through here: it is written through `/sync/push`.
 * Failures are ApiFailures (`E_FILE_TOO_LARGE`, `E_UNSUPPORTED_FILE`...).
 */
export interface DocumentsApi {
  upload(input: UploadDocumentInput): Promise<TripDocumentRow>
  download(tripId: string, documentId: string): Promise<Blob>
}

export const DOCUMENTS_API = new InjectionToken<DocumentsApi>('DOCUMENTS_API', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT)
    return new RealDocumentsApi({
      fetch: () => document.defaultView?.fetch.bind(document.defaultView) ?? fetch,
      language: () => document.documentElement.lang || undefined,
      cookies: () => document.cookie,
    })
  },
})
