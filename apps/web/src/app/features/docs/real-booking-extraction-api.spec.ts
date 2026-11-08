import type { BookingDraft } from '@monkitrips/shared'
import { ApiFailure } from '../../core/api/api-failure'
import { RealBookingExtractionApi } from './real-booking-extraction-api'

interface Sent {
  url: string
  init: RequestInit
}

function client(answer: () => Response) {
  const sent: Sent[] = []
  const api = new RealBookingExtractionApi({
    fetch: () => (url, init) => {
      sent.push({ url, init: init ?? {} })
      return Promise.resolve(answer())
    },
    language: () => 'es',
    cookies: () => 'other=1; XSRF-TOKEN=tok%3Den',
  })
  return { api, sent }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('RealBookingExtractionApi', () => {
  it('extract posts to the document with the session cookie, the xsrf token and the language', async () => {
    const { api, sent } = client(() => json(201, { data: { id: 'act-1' } }))

    const action = await api.extract('trip 1', 'doc-1')

    expect(action.id).toBe('act-1')
    expect(sent[0].url).toBe('/api/v1/trips/trip%201/documents/doc-1/extract')
    expect(sent[0].init.method).toBe('POST')
    expect(sent[0].init.credentials).toBe('same-origin')
    expect(sent[0].init.body).toBeUndefined()
    expect(sent[0].init.headers).toMatchObject({
      'X-XSRF-TOKEN': 'tok=en',
      'Accept-Language': 'es',
    })
  })

  it('revise sends the draft as json and accept unwraps the action', async () => {
    const { api, sent } = client(() =>
      json(200, { data: { id: 'act-1', action: { id: 'act-1' } } })
    )

    await api.revise('trip-1', 'act-1', { kind: 'other' } as BookingDraft)
    const accepted = await api.accept('trip-1', 'act-1')

    expect(sent[0].url).toBe('/api/v1/trips/trip-1/ai/actions/act-1/revise')
    expect(JSON.parse(sent[0].init.body as string)).toEqual({ draft: { kind: 'other' } })
    expect(sent[0].init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(sent[1].url).toBe('/api/v1/trips/trip-1/ai/actions/act-1/accept')
    expect(accepted.id).toBe('act-1')
  })

  it('a business error becomes an ApiFailure with its code', async () => {
    const { api } = client(() =>
      json(503, { message: 'No vision model', code: 'E_EXTRACTION_UNAVAILABLE' })
    )

    const failure = await api.extract('trip-1', 'doc-1').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiFailure)
    expect((failure as ApiFailure).code).toBe('E_EXTRACTION_UNAVAILABLE')
    expect((failure as ApiFailure).status).toBe(503)
  })
})
