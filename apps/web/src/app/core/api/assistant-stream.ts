import type { AssistantStreamEvent, AssistantStreamEventType } from '@monkitrips/shared'
import { ApiFailure } from './api-failure'
import { SseParser, type SseMessage } from './sse-parser'

const EVENT_TYPES: readonly AssistantStreamEventType[] = ['text', 'proposal', 'done', 'error']

/** One parsed SSE message as a chat event, or null for anything the contract does not name. */
function toEvent(message: SseMessage): AssistantStreamEvent | null {
  let data: unknown
  try {
    data = JSON.parse(message.data)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const type = (data as { type?: unknown }).type ?? message.event
  if (!EVENT_TYPES.includes(type as AssistantStreamEventType)) {
    return null
  }
  return { ...(data as object), type } as AssistantStreamEvent
}

/**
 * The body of a chat turn (`text/event-stream`) as `AssistantStreamEvent`s,
 * read with the body's own reader so the request's AbortSignal stops it
 * (the read then rejects with an AbortError). The turn ends with one
 * `done` or `error`; a body that ends before either is a cut connection
 * and fails as a network ApiFailure after the events that did arrive.
 */
export async function* readAssistantStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<AssistantStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const parser = new SseParser()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      const messages = done
        ? parser.push(decoder.decode()).concat(parser.end())
        : parser.push(decoder.decode(value, { stream: true }))
      for (const message of messages) {
        const event = toEvent(message)
        if (!event) {
          continue
        }
        yield event
        if (event.type === 'done' || event.type === 'error') {
          return
        }
      }
      if (done) {
        throw new ApiFailure({ kind: 'network', message: 'The stream ended before the answer' })
      }
    }
  } finally {
    reader.releaseLock()
    void body.cancel().catch(() => undefined)
  }
}
