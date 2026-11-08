import { DOCUMENT, Injectable, inject } from '@angular/core'

interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

/**
 * Keeps the screen on while a card is shown full screen (Wake Lock API).
 * Where the browser has no Wake Lock the calls do nothing. The browser
 * drops the lock when the page is hidden, so `hold` takes it again when the
 * page comes back, until `release`.
 */
@Injectable({ providedIn: 'root' })
export class ScreenWakeLock {
  private readonly document = inject(DOCUMENT)
  private sentinel: WakeLockSentinelLike | null = null
  private wanted = false
  private readonly onVisible = () => {
    if (this.wanted && this.document.visibilityState === 'visible') {
      void this.acquire()
    }
  }

  private get api(): WakeLockLike | null {
    const navigator = this.document.defaultView?.navigator as
      (Navigator & { wakeLock?: WakeLockLike }) | undefined
    return navigator?.wakeLock ?? null
  }

  /** Whether this browser can keep the screen on. */
  get supported(): boolean {
    return this.api !== null
  }

  async hold(): Promise<void> {
    if (this.wanted) {
      return
    }
    this.wanted = true
    this.document.addEventListener('visibilitychange', this.onVisible)
    await this.acquire()
  }

  async release(): Promise<void> {
    this.wanted = false
    this.document.removeEventListener('visibilitychange', this.onVisible)
    const sentinel = this.sentinel
    this.sentinel = null
    if (sentinel && !sentinel.released) {
      await sentinel.release().catch(() => undefined)
    }
  }

  private async acquire(): Promise<void> {
    const api = this.api
    if (!api || (this.sentinel && !this.sentinel.released)) {
      return
    }
    try {
      const sentinel = await api.request('screen')
      if (this.wanted) {
        this.sentinel = sentinel
      } else {
        await sentinel.release()
      }
    } catch {
      // Refused (battery saver, a hidden page): the card still shows.
    }
  }
}
