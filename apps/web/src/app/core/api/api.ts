import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import type { ApiClient } from './api-client'

export type { ApiClient } from './api-client'

/**
 * The typed API client generated from the API's Tuyau registry, behind a
 * lazy getter: the first call loads the client chunk, later calls reuse it.
 * The API serves this SPA, so requests go to the current origin (Tuyau needs
 * an absolute base URL, hence `location.origin`). Only core/api talks to
 * Tuyau (architecture.spec.ts).
 */
export const API = new InjectionToken<() => Promise<ApiClient>>('TuyauClient', {
  providedIn: 'root',
  factory: () => {
    const origin = inject(DOCUMENT).location.origin
    let client: Promise<ApiClient> | undefined
    return () =>
      (client ??= import('./api-client').then(({ createApiClient }) => createApiClient(origin)))
  },
})
