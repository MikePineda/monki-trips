import type {
  AiAction,
  AiConversation,
  AiConversationDetail,
  ApiEnvelope,
  AssistantStreamEvent,
} from '@monkitrips/shared'
import { ApiFailure, toApiFailure } from './api-failure'
import type { AcceptedAiAction, AssistantApi, SendAssistantMessage } from './assistant-api'
import { readAssistantStream } from './assistant-stream'
import type { FetchLike } from './real-activity-api'
import { xsrfToken } from './real-documents-api'

export interface RealAssistantApiOptions {
  fetch: () => FetchLike
  /** The UI language, sent as Accept-Language so error messages match the screen. */
  language: () => string | undefined
  /** `document.cookie`, read for the XSRF token on writes. */
  cookies: () => string
}

/** `/api/v1/trips/:tripId/ai/<collection>[/:id]`, every segment encoded. */
export function assistantPath(
  tripId: string,
  collection: 'conversations' | 'actions',
  id?: string
): string {
  const base = `/api/v1/trips/${encodeURIComponent(tripId)}/ai/${collection}`
  return id === undefined ? base : `${base}/${encodeURIComponent(id)}`
}

/**
 * `AssistantApi` over `fetch`. The chat turn is a POST that answers
 * `text/event-stream`, which neither `EventSource` (GET only) nor the
 * typed client (JSON) can read, so every assistant call follows the
 * contract by hand in one place: same origin, the session cookie, the
 * XSRF header on writes, the language, failures mapped like the typed
 * client maps them.
 */
export class RealAssistantApi implements AssistantApi {
  constructor(private readonly options: RealAssistantApiOptions) {}

  async list(tripId: string): Promise<AiConversation[]> {
    return this.json<AiConversation[]>(assistantPath(tripId, 'conversations'))
  }

  async create(tripId: string): Promise<AiConversation> {
    return this.json<AiConversation>(assistantPath(tripId, 'conversations'), 'POST', {})
  }

  async detail(tripId: string, conversationId: string): Promise<AiConversationDetail> {
    return this.json<AiConversationDetail>(assistantPath(tripId, 'conversations', conversationId))
  }

  async remove(tripId: string, conversationId: string): Promise<void> {
    await this.request(assistantPath(tripId, 'conversations', conversationId), {
      method: 'DELETE',
      headers: this.headers(true),
    })
  }

  async send(message: SendAssistantMessage): Promise<AsyncIterable<AssistantStreamEvent>> {
    const headers = this.headers(true)
    headers['Accept'] = 'text/event-stream'
    headers['Content-Type'] = 'application/json'
    const response = await this.request(
      `${assistantPath(message.tripId, 'conversations', message.conversationId)}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: message.text }),
        cache: 'no-store',
        signal: message.signal,
      }
    )
    if (!response.body) {
      throw new ApiFailure({ kind: 'network', message: 'The stream has no body' })
    }
    return readAssistantStream(response.body)
  }

  async accept(tripId: string, actionId: string): Promise<AcceptedAiAction> {
    return this.json<AcceptedAiAction>(
      `${assistantPath(tripId, 'actions', actionId)}/accept`,
      'POST',
      {}
    )
  }

  async reject(tripId: string, actionId: string): Promise<AiAction> {
    const { action } = await this.json<{ action: AiAction }>(
      `${assistantPath(tripId, 'actions', actionId)}/reject`,
      'POST',
      {}
    )
    return action
  }

  private async json<T>(url: string, method: 'GET' | 'POST' = 'GET', body?: object): Promise<T> {
    const write = method !== 'GET'
    const headers = this.headers(write)
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    const response = await this.request(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
    if (!envelope || envelope.data === undefined) {
      throw new ApiFailure({ kind: 'http', status: response.status, message: 'Empty answer' })
    }
    return envelope.data
  }

  private headers(write: boolean): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const language = this.options.language()
    if (language) {
      headers['Accept-Language'] = language
    }
    if (write) {
      const token = xsrfToken(this.options.cookies())
      if (token) {
        headers['X-XSRF-TOKEN'] = token
      }
    }
    return headers
  }

  /** Sends the request; no answer is a network failure, a non-2xx an http one. */
  private async request(url: string, init: RequestInit): Promise<Response> {
    let response: Response
    try {
      response = await this.options.fetch()(url, { credentials: 'same-origin', ...init })
    } catch (error) {
      if (init.signal?.aborted) {
        throw error
      }
      throw new ApiFailure({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Network error',
      })
    }
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      throw toApiFailure({
        kind: 'http',
        status: response.status,
        response: body,
        rawResponse: { headers: response.headers },
        message: `Request failed with status ${response.status}`,
      })
    }
    return response
  }
}
