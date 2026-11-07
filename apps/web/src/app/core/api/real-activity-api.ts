import type { ApiEnvelope } from '@monkitrips/shared'
import type { ActivityApi, ActivityPage, TripActivityEntry } from './activity-api'
import { ApiFailure, toApiFailure } from './api-failure'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Builds the feed URL of a trip, with the cursor when there is one. */
export function activityPath(tripId: string, cursor: string | null): string {
  const path = `/api/v1/trips/${encodeURIComponent(tripId)}/activity`
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path
}

/**
 * `ActivityApi` over `fetch`: the route is not in the API's Tuyau registry
 * yet, so this client follows the contract by hand (same origin, the
 * session cookie, `Accept-Language` from the document) and maps every
 * failure like the typed client does. It becomes a one-line
 * `api.request('trips.activity', ...)` once the route lands.
 */
export class RealActivityApi implements ActivityApi {
  constructor(
    private readonly fetchImpl: () => FetchLike,
    private readonly language: () => string | undefined
  ) {}

  async page(tripId: string, cursor: string | null): Promise<ActivityPage> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const language = this.language()
    if (language) {
      headers['Accept-Language'] = language
    }
    let response: Response
    try {
      response = await this.fetchImpl()(activityPath(tripId, cursor), {
        credentials: 'same-origin',
        headers,
      })
    } catch (error) {
      throw new ApiFailure({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Network error',
      })
    }
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      throw toApiFailure({
        kind: 'http',
        status: response.status,
        response: body,
        rawResponse: { headers: response.headers },
        message: `Request failed with status ${response.status}`,
      })
    }
    const envelope = body as ApiEnvelope<TripActivityEntry[], { nextCursor?: string | null }>
    return {
      entries: Array.isArray(envelope?.data) ? envelope.data : [],
      nextCursor: envelope?.metadata?.nextCursor ?? null,
    }
  }
}
