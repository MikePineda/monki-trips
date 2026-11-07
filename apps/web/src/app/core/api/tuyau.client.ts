import { createTuyau } from '@tuyau/core/client'
import { registry } from '@monkitrips/api/registry'

export interface ApiClientOptions {
  /** The web app's origin: the API serves the SPA, so requests stay same-origin. */
  baseUrl: string
  /** The UI language of the moment, sent as Accept-Language so error messages match the screen. */
  language?: () => string | undefined
}

/**
 * The typed Tuyau client over the API's route registry. Same origin and the
 * session cookie travel by default; Tuyau itself copies the `XSRF-TOKEN`
 * cookie into the `X-XSRF-TOKEN` header of every mutating request (the
 * cookie arrives with the first GET, `config.show` on boot). Loaded lazily
 * (see api.ts) so the client and the registry stay out of the initial bundle.
 */
export function createApiClient(options: ApiClientOptions) {
  return createTuyau({
    baseUrl: options.baseUrl,
    registry,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    // Never retry on our own: screens offer an explicit "Try again".
    retry: 0,
    hooks: {
      beforeRequest: [
        (request) => {
          const language = options.language?.()
          if (language) {
            request.headers.set('Accept-Language', language)
          }
        },
      ],
    },
  })
}

export type ApiClient = ReturnType<typeof createApiClient>
