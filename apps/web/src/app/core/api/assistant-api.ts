import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import type {
  AiAction,
  AiConversation,
  AiConversationDetail,
  AssistantStreamEvent,
  SyncMutationResult,
} from '@monkitrips/shared'
import { RealAssistantApi } from './real-assistant-api'

export interface SendAssistantMessage {
  tripId: string
  conversationId: string
  /** 1 to `ASSISTANT_MESSAGE_MAX_LENGTH` characters. */
  text: string
  /** Aborting it stops the stream (the server keeps what was streamed). */
  signal: AbortSignal
}

/** `POST …/ai/actions/:id/accept`: the action, now `accepted`, and what each mutation did. */
export interface AcceptedAiAction {
  action: AiAction
  results: SyncMutationResult[]
}

/**
 * The trip assistant (`/trips/:tripId/ai/…`), online only: the member's
 * own conversations, a chat turn as a stream of `AssistantStreamEvent`s
 * and the decision on a proposal. Failures are ApiFailures: `send`
 * rejects before the first event with 402 `E_LLM_QUOTA_EXCEEDED`
 * (details `{ used, cap, resetsOn }`), 429 `E_TOO_MANY_REQUESTS`, 404 or
 * a network failure; once streaming, a failure arrives as an `error`
 * event. `accept` fails with 409 `E_AI_ACTION_STALE` or
 * `E_AI_ACTION_CLOSED` (details `{ status }`).
 */
export interface AssistantApi {
  list(tripId: string): Promise<AiConversation[]>
  create(tripId: string): Promise<AiConversation>
  detail(tripId: string, conversationId: string): Promise<AiConversationDetail>
  remove(tripId: string, conversationId: string): Promise<void>
  /** Resolves once the stream is open; iterate it for the events of the turn. */
  send(message: SendAssistantMessage): Promise<AsyncIterable<AssistantStreamEvent>>
  accept(tripId: string, actionId: string): Promise<AcceptedAiAction>
  reject(tripId: string, actionId: string): Promise<AiAction>
}

export const ASSISTANT_API = new InjectionToken<AssistantApi>('ASSISTANT_API', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT)
    return new RealAssistantApi({
      fetch: () => document.defaultView?.fetch.bind(document.defaultView) ?? fetch,
      language: () => document.documentElement.lang || undefined,
      cookies: () => document.cookie,
    })
  },
})
