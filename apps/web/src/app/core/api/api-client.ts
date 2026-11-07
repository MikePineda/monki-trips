import { createTuyau } from '@tuyau/core/client'
import { registry } from '@monkitrips/api/registry'

/**
 * Builds the typed Tuyau client from the API's route registry. Loaded lazily
 * (see api.ts) so the client and the registry stay out of the initial bundle.
 */
export function createApiClient(baseUrl: string) {
  return createTuyau({
    baseUrl,
    registry,
    headers: { Accept: 'application/json' },
    // Never retry on our own: screens offer an explicit "Try again".
    retry: 0,
  })
}

export type ApiClient = ReturnType<typeof createApiClient>
