import type { ApiEnvelope, TripDocumentRow } from '@monkitrips/shared'
import { ApiFailure, toApiFailure } from './api-failure'
import type { DocumentsApi, UploadDocumentInput } from './documents-api'
import type { FetchLike } from './real-activity-api'

export interface RealDocumentsApiOptions {
  fetch: () => FetchLike
  /** The UI language, sent as Accept-Language so error messages match the screen. */
  language: () => string | undefined
  /** `document.cookie`, read for the XSRF token on writes. */
  cookies: () => string
}

export function documentsPath(tripId: string): string {
  return `/api/v1/trips/${encodeURIComponent(tripId)}/documents`
}

export function documentFilePath(tripId: string, documentId: string): string {
  return `${documentsPath(tripId)}/${encodeURIComponent(documentId)}/file`
}

/** The value of the `XSRF-TOKEN` cookie the API hands out with every GET, decoded. */
export function xsrfToken(cookies: string): string | null {
  for (const part of cookies.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === 'XSRF-TOKEN') {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

/**
 * `DocumentsApi` over `fetch`: the typed client sends JSON bodies, and an
 * upload is multipart, so this follows the contract by hand like Tuyau
 * would (same origin, the session cookie, the XSRF header, the language).
 * A download follows the redirect to the signed URL and reads the bytes.
 */
export class RealDocumentsApi implements DocumentsApi {
  constructor(private readonly options: RealDocumentsApiOptions) {}

  async upload(input: UploadDocumentInput): Promise<TripDocumentRow> {
    const form = new FormData()
    form.append('id', input.id)
    form.append('title', input.title)
    for (const tag of input.tags) {
      form.append('tags[]', tag)
    }
    if (input.eventId) {
      form.append('eventId', input.eventId)
    }
    form.append('file', input.file, input.fileName)
    const headers = this.headers()
    const token = xsrfToken(this.options.cookies())
    if (token) {
      headers['X-XSRF-TOKEN'] = token
    }
    const response = await this.send(documentsPath(input.tripId), {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: form,
    })
    const body = (await response.json().catch(() => null)) as ApiEnvelope<TripDocumentRow> | null
    if (!body?.data) {
      throw new ApiFailure({ kind: 'http', status: response.status, message: 'Empty answer' })
    }
    return body.data
  }

  async download(tripId: string, documentId: string): Promise<Blob> {
    const response = await this.send(documentFilePath(tripId, documentId), {
      credentials: 'same-origin',
      headers: this.headers(),
      redirect: 'follow',
      cache: 'no-store',
    })
    return response.blob()
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const language = this.options.language()
    if (language) {
      headers['Accept-Language'] = language
    }
    return headers
  }

  /** Sends the request; no answer is a network failure, a non-2xx an http one. */
  private async send(url: string, init: RequestInit): Promise<Response> {
    let response: Response
    try {
      response = await this.options.fetch()(url, init)
    } catch (error) {
      throw new ApiFailure({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Network error',
      })
    }
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      throw toApiFailure({
        kind: 'http',
        status: response.status,
        response: body,
        rawResponse: { headers: response.headers },
        message: `Request failed with status ${response.status}`,
      })
    }
    return response
  }
}
