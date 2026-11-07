import type { EnvironmentProviders } from '@angular/core'
import { provideServiceWorker } from '@angular/service-worker'

/**
 * SwUpdate for specs that render the shell: the service worker providers
 * with registration disabled, so UpdateService sees `isEnabled === false`
 * and nothing talks to a worker.
 */
export function providePwaTesting(): EnvironmentProviders {
  return provideServiceWorker('sw.js', { enabled: false })
}
