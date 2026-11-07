import { DOCUMENT, InjectionToken, inject } from '@angular/core'
import type { HealthReport } from '@monkitrips/shared'

/** Reads the running build's version and sha from the API's readiness probe. */
export interface HealthApi {
  health(): Promise<HealthReport>
}

/**
 * Plain fetch against the same origin: the probe is outside the Tuyau
 * contract's versioned routes and must work before the typed client loads.
 */
export class FetchHealthApi implements HealthApi {
  constructor(private readonly fetchFn: typeof fetch) {}

  async health(): Promise<HealthReport> {
    const response = await this.fetchFn('/api/health', { headers: { Accept: 'application/json' } })
    if (!response.ok && response.status !== 503) {
      throw new Error(`health probe answered ${response.status}`)
    }
    return (await response.json()) as HealthReport
  }
}

export const HEALTH_API = new InjectionToken<HealthApi>('HEALTH_API', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView
    return new FetchHealthApi(view ? view.fetch.bind(view) : fetch)
  },
})
