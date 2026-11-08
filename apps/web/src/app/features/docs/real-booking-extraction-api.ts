import type { AiAction, ApiEnvelope, BookingDraft } from '@monkitrips/shared'
import { ApiFailure, toApiFailure } from '../../core/api/api-failure'
import {
  documentsPath,
  xsrfToken,
  type RealDocumentsApiOptions,
} from '../../core/api/real-documents-api'
import type { BookingExtractionApi } from './booking-extraction-api'

/** `/api/v1/trips/:tripId/ai/actions/:id/<verb>`. */
export function aiActionPath(tripId: string, actionId: string, verb: string): string {
  return `/api/v1/trips/${encodeURIComponent(tripId)}/ai/actions/${encodeURIComponent(actionId)}/${verb}`
}

/** `/api/v1/trips/:tripId/documents/:id/extract`. */
export function extractBookingPath(tripId: string, documentId: string): string {
  return `${documentsPath(tripId)}/${encodeURIComponent(documentId)}/extract`
}

/**
 * `BookingExtractionApi` over `fetch`: the routes are not in the typed
 * client yet, so this follows the contract by hand like the documents
 * client (same origin, the session cookie, the XSRF header, the language)
 * and maps every failure to an ApiFailure.
 */
export class RealBookingExtractionApi implements BookingExtractionApi {
  constructor(private readonly options: RealDocumentsApiOptions) {}

  async extract(tripId: string, documentId: string): Promise<AiAction> {
    return this.post<AiAction>(extractBookingPath(tripId, documentId))
  }

  async revise(tripId: string, actionId: string, draft: BookingDraft): Promise<AiAction> {
    return this.post<AiAction>(aiActionPath(tripId, actionId, 'revise'), { draft })
  }

  async accept(tripId: string, actionId: string): Promise<AiAction> {
    const data = await this.post<{ action: AiAction }>(aiActionPath(tripId, actionId, 'accept'))
    return data.action
  }

  async reject(tripId: string, actionId: string): Promise<AiAction> {
    const data = await this.post<{ action: AiAction }>(aiActionPath(tripId, actionId, 'reject'))
    return data.action
  }

  private async post<T>(url: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const language = this.options.language()
    if (language) {
      headers['Accept-Language'] = language
    }
    const token = xsrfToken(this.options.cookies())
    if (token) {
      headers['X-XSRF-TOKEN'] = token
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    let response: Response
    try {
      response = await this.options.fetch()(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
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
    const envelope = answer as ApiEnvelope<T> | null
    if (!envelope?.data) {
      throw new ApiFailure({ kind: 'http', status: response.status, message: 'Empty answer' })
    }
    return envelope.data
  }
}
