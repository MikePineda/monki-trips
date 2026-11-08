import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import type { AiAction, BookingDraft } from '@monkitrips/shared'
import { RealBookingExtractionApi } from './real-booking-extraction-api'

/**
 * Reading a booking from a document of the trip (WP 3.3), online only.
 * `extract` asks the server to read the file and answers a proposed
 * `extract_booking` action; nothing is written until `accept`. `revise`
 * replaces the draft with the member's corrections (re-validated, review
 * flags recomputed). The new event reaches the device through the pull.
 * Failures are ApiFailures: 503 `E_EXTRACTION_UNAVAILABLE` (a scan and no
 * vision model), 503 `E_LLM_UNAVAILABLE`, 402 `E_LLM_QUOTA_EXCEEDED`, 429,
 * 422 `E_LLM_BAD_OUTPUT` or field errors on a revise, 409
 * `E_AI_ACTION_STALE` / `E_AI_ACTION_CLOSED`, 415, 413, 404.
 */
export interface BookingExtractionApi {
  extract(tripId: string, documentId: string): Promise<AiAction>
  revise(tripId: string, actionId: string, draft: BookingDraft): Promise<AiAction>
  accept(tripId: string, actionId: string): Promise<AiAction>
  reject(tripId: string, actionId: string): Promise<AiAction>
}

export const BOOKING_EXTRACTION_API = new InjectionToken<BookingExtractionApi>(
  'BOOKING_EXTRACTION_API',
  {
    providedIn: 'root',
    factory: () => {
      const document = inject(DOCUMENT)
      return new RealBookingExtractionApi({
        fetch: () => document.defaultView?.fetch.bind(document.defaultView) ?? fetch,
        language: () => document.documentElement.lang || undefined,
        cookies: () => document.cookie,
      })
    },
  }
)
