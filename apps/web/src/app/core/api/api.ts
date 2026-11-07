import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import type { ApiClient } from './tuyau.client'

export type { ApiClient } from './tuyau.client'

/** Loads the typed client on first use and reuses it afterwards. */
export type ApiClientLoader = () => Promise<ApiClient>

/**
 * The typed API client generated from the API's Tuyau registry, behind a
 * lazy getter: the first call loads the client chunk, later calls reuse it.
 * The API serves this SPA, so requests go to the current origin (Tuyau needs
 * an absolute base URL, hence `location.origin`); the document's `lang`
 * (set by LangStore) travels as Accept-Language. Only core/api talks to
 * Tuyau (architecture.spec.ts).
 */
export const API = new InjectionToken<ApiClientLoader>('TuyauClient', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT)
    const baseUrl = document.location.origin
    let client: Promise<ApiClient> | undefined
    return () =>
      (client ??= import('./tuyau.client').then(({ createApiClient }) =>
        createApiClient({ baseUrl, language: () => document.documentElement.lang || undefined })
      ))
  },
})
