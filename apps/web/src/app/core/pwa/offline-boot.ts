import { DOCUMENT, Injectable, inject } from '@angular/core'
import { CLOCK } from '../offline/clock'
import { META_LAST_OFFLINE_BOOT_AT, MetaStore } from '../offline/meta.store'

/**
 * The airplane-mode rehearsal: when the app starts with no network, it
 * came from the service worker's cache, so the start itself proves the
 * phone can open the app offline. The app shell records the moment in
 * `meta` (a device fact: it survives a change of account) and "Ready to
 * fly" shows it as "Tested offline on …".
 */
@Injectable({ providedIn: 'root' })
export class OfflineBootRecorder {
  private readonly window = inject(DOCUMENT).defaultView
  private readonly meta = inject(MetaStore)
  private readonly clock = inject(CLOCK)

  /** Records a cold start without network; answers whether it did. */
  async record(): Promise<boolean> {
    if (this.window?.navigator.onLine !== false) {
      return false
    }
    await this.meta.set(META_LAST_OFFLINE_BOOT_AT, this.clock())
    return true
  }
}
