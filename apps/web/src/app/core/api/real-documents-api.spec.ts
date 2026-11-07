import { ApiFailure } from './api-failure'
import type { FetchLike } from './real-activity-api'
import { RealDocumentsApi, documentFilePath, xsrfToken } from './real-documents-api'

interface Call {
  url: string
  init?: RequestInit
}

function client(answer: (call: Call) => Response, cookies = 'XSRF-TOKEN=abc%3D%3D; other=1') {
  const calls: Call[] = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return answer({ url, init })
  }
  const api = new RealDocumentsApi({
    fetch: () => fetchImpl,
    language: () => 'es',
    cookies: () => cookies,
  })
  return { api, calls }
}

const ROW = {
  id: 'doc-1',
  tripId: 'trip-1',
  eventId: null,
  kind: 'file',
  title: 'Voucher',
  url: null,
  mime: 'application/pdf',
  sizeBytes: 4,
  sha256: 'abc',
  tags: ['print'],
  availableOffline: false,
  uploadedBy: 'u1',
  deletedAt: null,
  updatedAt: '2026-11-07T00:00:00.000Z',
}

describe('RealDocumentsApi', () => {
  it('reads the xsrf token from the cookies, decoded', () => {
    expect(xsrfToken('a=1; XSRF-TOKEN=abc%3D%3D')).toBe('abc==')
    expect(xsrfToken('a=1')).toBeNull()
  })

  it('upload posts the file, the client id, title, tags and event as multipart with the xsrf header', async () => {
    const { api, calls } = client(
      () => new Response(JSON.stringify({ data: ROW }), { status: 201 })
    )

    const row = await api.upload({
      tripId: 'trip-1',
      id: 'doc-1',
      file: new Blob(['%PDF'], { type: 'application/pdf' }),
      fileName: 'voucher.pdf',
      title: 'Voucher',
      tags: ['print', 'show_on_phone'],
      eventId: 'event-1',
    })

    expect(row.id).toBe('doc-1')
    expect(calls[0].url).toBe('/api/v1/trips/trip-1/documents')
    expect(calls[0].init?.method).toBe('POST')
    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers['X-XSRF-TOKEN']).toBe('abc==')
    expect(headers['Accept-Language']).toBe('es')
    const form = calls[0].init?.body as FormData
    expect(form.get('id')).toBe('doc-1')
    expect(form.get('title')).toBe('Voucher')
    expect(form.getAll('tags[]')).toEqual(['print', 'show_on_phone'])
    expect(form.get('eventId')).toBe('event-1')
    expect((form.get('file') as File).name).toBe('voucher.pdf')
  })

  it('an upload the server refuses becomes an ApiFailure with its code', async () => {
    const { api } = client(
      () =>
        new Response(JSON.stringify({ code: 'E_FILE_TOO_LARGE', message: 'Too large' }), {
          status: 413,
        })
    )

    const failure = await api
      .upload({
        tripId: 'trip-1',
        id: 'doc-1',
        file: new Blob(['x']),
        fileName: 'x.pdf',
        title: 'X',
        tags: [],
        eventId: null,
      })
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiFailure)
    expect((failure as ApiFailure).is('E_FILE_TOO_LARGE')).toBe(true)
  })

  it('download follows the redirect of the file route and answers the bytes', async () => {
    const { api, calls } = client(() => new Response('%PDF-bytes', { status: 200 }))

    const blob = await api.download('trip-1', 'doc-1')

    expect(await blob.text()).toBe('%PDF-bytes')
    expect(calls[0].url).toBe(documentFilePath('trip-1', 'doc-1'))
    expect(calls[0].init?.redirect).toBe('follow')
  })

  it('no answer is a network failure', async () => {
    const api = new RealDocumentsApi({
      fetch: () => () => Promise.reject(new TypeError('Failed to fetch')),
      language: () => undefined,
      cookies: () => '',
    })

    const failure = await api.download('trip-1', 'doc-1').catch((error: unknown) => error)

    expect((failure as ApiFailure).kind).toBe('network')
  })
})
