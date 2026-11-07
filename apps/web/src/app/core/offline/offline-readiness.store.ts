import { Injectable, computed, inject, type Signal } from '@angular/core'
import type { OfflineDocumentState } from '@monkitrips/shared'
import { DocumentCopiesStore } from './document-copies.store'
import { DocumentsStore } from './documents.store'

/** The documents part of "Ready to fly". */
export interface DocumentsReadiness {
  ready: boolean
  /** Files of the trip. */
  total: number
  /** Files without a copy, or whose copy's hash differs from the server's. */
  documentIds: string[]
  /** The input of the shared `offlineReadiness` documents check. */
  states: OfflineDocumentState[]
}

/**
 * "Ready to fly" (WP 2.5) as the device can tell it. Today: documents,
 * ready when every file of the trip has a saved copy whose sha256 equals
 * the server's. Links need no copy.
 */
@Injectable({ providedIn: 'root' })
export class OfflineReadinessStore {
  private readonly documents = inject(DocumentsStore)
  private readonly copies = inject(DocumentCopiesStore)

  documentsFor(tripId: Signal<string>): Signal<DocumentsReadiness> {
    const documents = this.documents.forTrip(tripId)
    return computed(() => {
      const copies = this.copies.copies()
      const states = documents()
        .filter((document) => document.kind === 'file')
        .map((document) => ({
          id: document.id,
          serverSha256: document.sha256 ?? '',
          cachedSha256: copies.get(document.id)?.sha256 ?? null,
        }))
      const documentIds = states
        .filter((state) => state.cachedSha256 === null || state.cachedSha256 !== state.serverSha256)
        .map((state) => state.id)
      return { ready: documentIds.length === 0, total: states.length, documentIds, states }
    })
  }
}
