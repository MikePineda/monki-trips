import { Injectable, computed, inject, signal } from '@angular/core'
import type { AppConfig } from '@monkitrips/shared'
import { AUTH_API } from './auth-api'

/**
 * The server's public configuration (`GET /config`), read once per app
 * run and on demand again after a failure. While it is unknown (not read
 * yet, or offline) every feature reads as available: the server still
 * answers with a reason when it cannot do something.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigStore {
  private readonly auth = inject(AUTH_API)
  private readonly config = signal<AppConfig | null>(null)
  private loading: Promise<void> | null = null

  /** Whether the server can read photos and scanned PDFs. */
  readonly visionEnabled = computed(() => this.config()?.visionEnabled ?? true)

  /** Reads the config unless it was read already; a failure leaves it unknown. */
  load(): Promise<void> {
    this.loading ??= this.auth
      .config()
      .then((config) => this.config.set(config))
      .catch(() => {
        this.loading = null
      })
    return this.loading
  }
}
