import type { ApiEnvelope, ReceiptDraft } from '@monkitrips/shared'
import { ApiFailure, toApiFailure } from '../../core/api/api-failure'
import { xsrfToken, type RealDocumentsApiOptions } from '../../core/api/real-documents-api'
import type { ReceiptExtractionApi } from './receipt-extraction-api'

/** `/api/v1/trips/:tripId/receipts/extract`. */
export function receiptExtractPath(tripId: string): string {
  return `/api/v1/trips/${encodeURIComponent(tripId)}/receipts/extract`
}

/**
 * `ReceiptExtractionApi` over `fetch`: a multipart upload, so it follows
 * the contract by hand like the documents client (same origin, the session
 * cookie, the XSRF header, the language) and maps failures to ApiFailures.
 */
export class RealReceiptExtractionApi implements ReceiptExtractionApi {
  constructor(private readonly options: RealDocumentsApiOptions) {}

  async extract(tripId: string, photo: Blob): Promise<ReceiptDraft> {
    const form = new FormData()
    form.append('file', photo, 'receipt.jpg')
    const headers: Record<string, string> = { Accept: 'application/json' }
    const language = this.options.language()
    if (language) {
      headers['Accept-Language'] = language
    }
    const token = xsrfToken(this.options.cookies())
    if (token) {
      headers['X-XSRF-TOKEN'] = token
    }
    let response: Response
    try {
      response = await this.options.fetch()(receiptExtractPath(tripId), {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: form,
      })
    } catch (error) {
      throw new ApiFailure({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Network error',
      })
    }
    const answer: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      throw toApiFailure({
        kind: 'http',
        status: response.status,
        response: answer,
        rawResponse: { headers: response.headers },
        message: `Request failed with status ${response.status}`,
      })
    }
    const envelope = answer as ApiEnvelope<ReceiptDraft> | null
    if (!envelope?.data) {
      throw new ApiFailure({ kind: 'http', status: response.status, message: 'Empty answer' })
    }
    return envelope.data
  }
}
