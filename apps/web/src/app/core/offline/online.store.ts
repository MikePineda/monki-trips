import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core'

/**
 * Whether the browser believes it has a network: `navigator.onLine` plus
 * the window's `online` / `offline` events. "Online" only means a route
 * exists; a request can still fail, which the outbox handles with backoff.
 */
@Injectable({ providedIn: 'root' })
export class OnlineStore {
  private readonly window = inject(DOCUMENT).defaultView
  private readonly state = signal(this.window?.navigator.onLine ?? true)

  readonly online = this.state.asReadonly()

  constructor() {
    const win = this.window
    if (!win) {
      return
    }
    const goOnline = () => this.state.set(true)
    const goOffline = () => this.state.set(false)
    win.addEventListener('online', goOnline)
    win.addEventListener('offline', goOffline)
    inject(DestroyRef).onDestroy(() => {
      win.removeEventListener('online', goOnline)
      win.removeEventListener('offline', goOffline)
    })
  }
}
