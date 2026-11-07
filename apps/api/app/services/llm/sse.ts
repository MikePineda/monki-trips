/**
 * A minimal server-sent events reader over a `fetch` body: yields one
 * `{ event, data }` per message (multi-line `data:` joined with newlines),
 * ignores comments and unknown fields, and tolerates a stream that ends
 * without a final blank line.
 */
export interface SseEvent {
  event: string
  data: string
}

export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncIterable<SseEvent> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''
  let event = ''
  const data: string[] = []

  const flush = (): SseEvent | null => {
    if (data.length === 0) {
      event = ''
      return null
    }
    const message = { event: event || 'message', data: data.join('\n') }
    event = ''
    data.length = 0
    return message
  }

  const consumeLine = (line: string): SseEvent | null => {
    if (line === '') return flush()
    if (line.startsWith(':')) return null
    const colon = line.indexOf(':')
    const field = colon < 0 ? line : line.slice(0, colon)
    let value = colon < 0 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
    return null
  }

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        const message = consumeLine(line)
        if (message) yield message
      }
    }
    buffer += decoder.decode()
    for (const line of buffer.split('\n')) {
      const message = consumeLine(line.replace(/\r$/, ''))
      if (message) yield message
    }
    const last = flush()
    if (last) yield last
  } finally {
    reader.releaseLock()
  }
}
