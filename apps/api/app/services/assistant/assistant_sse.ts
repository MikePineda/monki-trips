import { PassThrough } from 'node:stream'
import type { AssistantStreamEvent } from '@monkitrips/shared'
import { ASSISTANT_SSE_PING_MS } from '#config/assistant'

export interface AssistantEventStreamOptions {
  /** How often a `: ping` comment is written while nothing else is. */
  pingMs?: number
  /** Aborted when the stream closes before the turn ended (the member went away). */
  aborter?: AbortController
}

/** One server-sent event: `event: <type>` and the event as JSON. */
export function sseEvent(event: AssistantStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * The body of a chat turn as `text/event-stream`: every event as it comes,
 * a `: ping` comment every `pingMs` so proxies keep a quiet stream (a long
 * tool run, a slow first token) open, and an abort plus a closed event
 * generator when the stream is destroyed early (the client went away), so
 * the turn makes no further model call and the model stream is settled.
 */
export function assistantEventStream(
  events: AsyncGenerator<AssistantStreamEvent>,
  options: AssistantEventStreamOptions = {}
): PassThrough {
  const stream = new PassThrough()
  const write = (text: string) => {
    if (!stream.destroyed && !stream.writableEnded) stream.write(text)
  }
  // A write racing the close must not surface as an unhandled stream error.
  stream.on('error', () => {})
  const ping = setInterval(() => write(': ping\n\n'), options.pingMs ?? ASSISTANT_SSE_PING_MS)
  let ended = false
  stream.on('close', () => {
    clearInterval(ping)
    if (!ended) {
      options.aborter?.abort()
      void events.return(undefined).catch(() => {})
    }
  })

  void (async () => {
    try {
      for await (const event of events) {
        if (stream.destroyed) break
        write(sseEvent(event))
      }
    } catch {
      // The turn turns its own failures into `error` events; anything else just ends the stream.
    } finally {
      ended = true
      clearInterval(ping)
      if (!stream.destroyed) stream.end()
    }
  })()
  return stream
}
