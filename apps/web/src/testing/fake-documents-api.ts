import type { TripDocumentRow } from '@monkitrips/shared'
import type { DocumentsApi, UploadDocumentInput } from '../app/core/api/documents-api'
import { FakeApi } from './fake-api'

/** A synthetic document row of trip `trip-1`, a PDF file unless overridden. */
export function documentRow(overrides: Partial<TripDocumentRow> = {}): TripDocumentRow {
  return {
    id: 'doc-1',
    tripId: 'trip-1',
    eventId: null,
    kind: 'file',
    title: 'Ferry voucher',
    url: null,
    mime: 'application/pdf',
    sizeBytes: 9,
    sha256: null,
    tags: [],
    availableOffline: false,
    uploadedBy: 'local-traveller',
    deletedAt: null,
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * In-memory stand-in for the documents routes: an upload answers the row
 * the server would store (the sha256 is whatever `nextSha256` says, the
 * bytes are kept); a download answers the bytes in `files`.
 */
export class FakeDocumentsApi extends FakeApi implements DocumentsApi {
  readonly uploads: UploadDocumentInput[] = []
  readonly files = new Map<string, Blob>()
  nextSha256: string | null = null

  upload(input: UploadDocumentInput): Promise<TripDocumentRow> {
    return this.run(`upload:${input.title}`, () => {
      this.uploads.push(input)
      this.files.set(input.id, input.file)
      return documentRow({
        id: input.id,
        tripId: input.tripId,
        eventId: input.eventId,
        title: input.title,
        tags: [...input.tags],
        mime: input.file.type || 'application/pdf',
        sizeBytes: input.file.size,
        sha256: this.nextSha256,
      })
    })
  }

  download(tripId: string, documentId: string): Promise<Blob> {
    return this.run(`download:${tripId}/${documentId}`, () => {
      const file = this.files.get(documentId)
      if (!file) {
        throw new Error(`no file for ${documentId}`)
      }
      return file
    })
  }
}
