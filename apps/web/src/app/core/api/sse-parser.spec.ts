import { SseParser } from './sse-parser'

describe('SseParser', () => {
  it('sse parser handles split chunks and comments', () => {
    const parser = new SseParser()
    const chunks = [
      ': ping\n\nevent: te',
      'xt\ndata: {"type":"text","text":"Hel',
      'lo"}\n',
      '\n: ping\n\n',
      'event: done\r\ndata: {"type":"done"}\r\n\r\n',
    ]

    const messages = chunks.flatMap((chunk) => parser.push(chunk))

    expect(messages).toEqual([
      { event: 'text', data: '{"type":"text","text":"Hello"}' },
      { event: 'done', data: '{"type":"done"}' },
    ])
  })

  it('joins multi-line data with line feeds and defaults the event to message', () => {
    const parser = new SseParser()

    expect(parser.push('data: one\ndata:two\n\n')).toEqual([{ event: 'message', data: 'one\ntwo' }])
  })

  it('a carriage return split from its line feed across chunks still ends one line', () => {
    const parser = new SseParser()

    expect(parser.push('event: text\r')).toEqual([])
    expect(parser.push('\ndata: {}\r')).toEqual([])
    expect(parser.push('\n\r\n')).toEqual([{ event: 'text', data: '{}' }])
  })

  it('a block without data is not an event, and an unfinished block waits for its blank line', () => {
    const parser = new SseParser()

    expect(parser.push('event: text\n\n')).toEqual([])
    expect(parser.push('event: text\ndata: {}\n')).toEqual([])
    expect(parser.end()).toEqual([])
    expect(parser.push('\n')).toEqual([])
  })
})
