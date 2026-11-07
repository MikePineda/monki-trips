import { ApiFailure } from './api-failure'
import { RealActivityApi, activityPath, type FetchLike } from './real-activity-api'

interface Call {
  url: string
  init?: RequestInit
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function client(answer: (call: Call) => Promise<Response> | Response, language?: string) {
  const calls: Call[] = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return answer({ url, init })
  }
  return {
    api: new RealActivityApi(
      () => fetchImpl,
      () => language
    ),
    calls,
  }
}

const ENTRY = {
  id: '12',
  tripId: 'trip-1',
  actorUserId: 'u1',
  actorName: 'Owner',
  entity: 'task',
  entityId: 't1',
  action: 'updated' as const,
  fields: ['doneAt'],
  createdAt: '2026-11-07T10:00:00.000Z',
}

describe('RealActivityApi', () => {
  it('builds the feed path of a trip, adding the cursor only when there is one', () => {
    expect(activityPath('trip-1', null)).toBe('/api/v1/trips/trip-1/activity')
    expect(activityPath('trip-1', 'c/1+2')).toBe('/api/v1/trips/trip-1/activity?cursor=c%2F1%2B2')
  })

  it('asks the same origin with the session cookie and the UI language and reads the envelope', async () => {
    const { api, calls } = client(
      () => jsonResponse(200, { data: [ENTRY], metadata: { nextCursor: 'next-1' } }),
      'es'
    )

    const page = await api.page('trip-1', null)

    expect(calls[0].url).toBe('/api/v1/trips/trip-1/activity')
    expect(calls[0].init?.credentials).toBe('same-origin')
    expect((calls[0].init?.headers as Record<string, string>)['Accept-Language']).toBe('es')
    expect(page.entries).toEqual([ENTRY])
    expect(page.nextCursor).toBe('next-1')
  })

  it('the last page has no next cursor', async () => {
    const { api } = client(() => jsonResponse(200, { data: [] }))

    const page = await api.page('trip-1', 'next-1')

    expect(page).toEqual({ entries: [], nextCursor: null })
  })

  it('a business error becomes an ApiFailure with the code the server sent', async () => {
    const { api } = client(() =>
      jsonResponse(404, { message: 'Route not found', code: 'E_ROUTE_NOT_FOUND' })
    )

    const failure = await api.page('trip-1', null).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiFailure)
    expect((failure as ApiFailure).code).toBe('E_ROUTE_NOT_FOUND')
    expect((failure as ApiFailure).status).toBe(404)
  })

  it('no answer at all is a network failure', async () => {
    const { api } = client(() => Promise.reject(new TypeError('Failed to fetch')))

    const failure = await api.page('trip-1', null).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiFailure)
    expect((failure as ApiFailure).kind).toBe('network')
  })
})
