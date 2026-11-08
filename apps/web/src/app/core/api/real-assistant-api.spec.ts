import type { AssistantStreamEvent } from '@monkitrips/shared'
import { ApiFailure } from './api-failure'
import type { FetchLike } from './real-activity-api'
import { RealAssistantApi, assistantPath } from './real-assistant-api'

interface Call {
  url: string
  init?: RequestInit
}

function client(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return answer({ url, init })
  }
  const api = new RealAssistantApi({
    fetch: () => fetchImpl,
    language: () => 'es',
    cookies: () => 'XSRF-TOKEN=tok%3D; other=1',
  })
  return { api, calls }
}

/** A streaming body that hands out the given chunks one read at a time. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]))
      } else {
        controller.close()
      }
    },
  })
}

async function collect(events: AsyncIterable<AssistantStreamEvent>) {
  const seen: AssistantStreamEvent[] = []
  for await (const event of events) {
    seen.push(event)
  }
  return seen
}

describe('RealAssistantApi', () => {
  it('builds the paths of the contract with encoded ids', () => {
    expect(assistantPath('trip 1', 'conversations', 'c/1')).toBe(
      '/api/v1/trips/trip%201/ai/conversations/c%2F1'
    )
  })

  it('send posts the text with the xsrf header and yields the stream events, ignoring pings', async () => {
    const { api, calls } = client(
      () =>
        new Response(
          streamOf([
            ': ping\n\n',
            'event: text\ndata: {"type":"text","text":"Hi "}\n\nevent: te',
            'xt\ndata: {"type":"text","text":"there"}\n\n',
            'event: done\ndata: {"type":"done","conversationId":"c1","messageId":"m2","title":"Hi"}\n\n',
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
    )

    const events = await api.send({
      tripId: 't1',
      conversationId: 'c1',
      text: 'Hello',
      signal: new AbortController().signal,
    })
    const seen = await collect(events)

    expect(calls[0].url).toBe('/api/v1/trips/t1/ai/conversations/c1/messages')
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ text: 'Hello' })
    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers['X-XSRF-TOKEN']).toBe('tok=')
    expect(headers['Accept']).toBe('text/event-stream')
    expect(headers['Accept-Language']).toBe('es')
    expect(seen).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'text', text: 'there' },
      { type: 'done', conversationId: 'c1', messageId: 'm2', title: 'Hi' },
    ])
  })

  it('send rejects with the quota failure before any event', async () => {
    const { api } = client(
      () =>
        new Response(
          JSON.stringify({
            code: 'E_LLM_QUOTA_EXCEEDED',
            message: 'Quota',
            used: 10,
            cap: 10,
            resetsOn: '2026-12-01',
          }),
          { status: 402 }
        )
    )

    const failure = await api
      .send({ tripId: 't1', conversationId: 'c1', text: 'x', signal: new AbortController().signal })
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiFailure)
    expect((failure as ApiFailure).code).toBe('E_LLM_QUOTA_EXCEEDED')
    expect((failure as ApiFailure).details['resetsOn']).toBe('2026-12-01')
  })

  it('a stream cut before done or error ends with a network failure', async () => {
    const { api } = client(
      () => new Response(streamOf(['event: text\ndata: {"type":"text","text":"Hal"}\n\n']))
    )

    const events = await api.send({
      tripId: 't1',
      conversationId: 'c1',
      text: 'x',
      signal: new AbortController().signal,
    })
    const seen: AssistantStreamEvent[] = []
    const failure = await (async () => {
      for await (const event of events) seen.push(event)
    })().catch((error: unknown) => error)

    expect(seen).toEqual([{ type: 'text', text: 'Hal' }])
    expect(failure).toBeInstanceOf(ApiFailure)
    expect((failure as ApiFailure).kind).toBe('network')
  })

  it('accept answers the action and the results; a stale action is a 409 failure', async () => {
    const action = { id: 'a1', status: 'accepted' }
    const { api, calls } = client(({ url }) =>
      url.endsWith('/a1/accept')
        ? new Response(JSON.stringify({ data: { action, results: [] } }))
        : new Response(JSON.stringify({ code: 'E_AI_ACTION_STALE', message: 'Stale' }), {
            status: 409,
          })
    )

    expect(await api.accept('t1', 'a1')).toEqual({ action, results: [] })
    expect(calls[0].url).toBe('/api/v1/trips/t1/ai/actions/a1/accept')
    const failure = await api.accept('t1', 'a2').catch((error: unknown) => error)
    expect((failure as ApiFailure).code).toBe('E_AI_ACTION_STALE')
  })

  it('list, create, detail, remove and reject follow the routes of the contract', async () => {
    const { api, calls } = client(({ url, init }) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      if (url.endsWith('/reject')) {
        return new Response(JSON.stringify({ data: { action: { id: 'a1' } } }))
      }
      return new Response(JSON.stringify({ data: { id: 'c1' } }), {
        status: init?.method === 'POST' ? 201 : 200,
      })
    })

    await api.list('t1')
    await api.create('t1')
    await api.detail('t1', 'c1')
    await api.remove('t1', 'c1')
    expect(await api.reject('t1', 'a1')).toEqual({ id: 'a1' })

    expect(calls.map((call) => `${call.init?.method ?? 'GET'} ${call.url}`)).toEqual([
      'GET /api/v1/trips/t1/ai/conversations',
      'POST /api/v1/trips/t1/ai/conversations',
      'GET /api/v1/trips/t1/ai/conversations/c1',
      'DELETE /api/v1/trips/t1/ai/conversations/c1',
      'POST /api/v1/trips/t1/ai/actions/a1/reject',
    ])
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({})
  })
})
