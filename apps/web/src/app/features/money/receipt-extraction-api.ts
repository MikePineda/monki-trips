import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import type { ReceiptDraft } from '@monkitrips/shared'
import { RealReceiptExtractionApi } from './real-receipt-extraction-api'

/**
 * Reading a receipt photo (`POST /trips/:tripId/receipts/extract`,
 * multipart field `file`), online only. The photo is not stored and no
 * proposal row is kept: the answer only fills the quick expense sheet, and
 * the member saves a normal expense through the outbox. Failures are
 * ApiFailures (`E_LLM_UNAVAILABLE`, `E_EXTRACTION_UNAVAILABLE`,
 * `E_LLM_QUOTA_EXCEEDED`, 429, `E_LLM_BAD_OUTPUT`, 415, 413).
 */
export interface ReceiptExtractionApi {
  extract(tripId: string, photo: Blob): Promise<ReceiptDraft>
}

export const RECEIPT_EXTRACTION_API = new InjectionToken<ReceiptExtractionApi>(
  'RECEIPT_EXTRACTION_API',
  {
    providedIn: 'root',
    factory: () => {
      const document = inject(DOCUMENT)
      return new RealReceiptExtractionApi({
        fetch: () => document.defaultView?.fetch.bind(document.defaultView) ?? fetch,
        language: () => document.documentElement.lang || undefined,
        cookies: () => document.cookie,
      })
    },
  }
)
