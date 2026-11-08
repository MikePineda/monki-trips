/** One server-sent event: its `event:` name (`message` when absent) and its `data:` lines joined. */
export interface SseMessage {
  event: string
  data: string
}

/**
 * The `text/event-stream` format, decoded text in and whole events out,
 * whatever way the network cuts the chunks: lines end in LF, CRLF or CR
 * (a CR at the end of a chunk waits for the next one), a blank line ends
 * an event, lines starting with `:` are comments (the keep-alive
 * `: ping`), `data:` lines join with LF, `id:` and `retry:` are ignored
 * (the chat never reconnects). A block without data dispatches nothing,
 * and `end()` drops an unfinished block, as the spec says. Pure.
 */
export class SseParser {
  private buffer = ''
  private event = ''
  private data: string[] = []

  /** Feeds a decoded chunk; answers the events it completed, in order. */
  push(chunk: string): SseMessage[] {
    this.buffer += chunk
    const messages: SseMessage[] = []
    for (;;) {
      const match = /\r\n|\r|\n/.exec(this.buffer)
      if (!match) {
        break
      }
      // A lone CR at the very end may be the first half of a CRLF: wait for more.
      if (match[0] === '\r' && match.index === this.buffer.length - 1) {
        break
      }
      const line = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      const message = this.line(line)
      if (message) {
        messages.push(message)
      }
    }
    return messages
  }

  /** The stream ended: an unfinished event is dropped and the parser starts clean. */
  end(): SseMessage[] {
    this.buffer = ''
    this.event = ''
    this.data = []
    return []
  }

  private line(line: string): SseMessage | null {
    if (line === '') {
      const message =
        this.data.length > 0 ? { event: this.event || 'message', data: this.data.join('\n') } : null
      this.event = ''
      this.data = []
      return message
    }
    if (line.startsWith(':')) {
      return null
    }
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) {
      value = value.slice(1)
    }
    if (field === 'event') {
      this.event = value
    } else if (field === 'data') {
      this.data.push(value)
    }
    return null
  }
}
