import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core'
import { isIosUserAgent } from '../../domain/platform'

/** Chromium's `beforeinstallprompt` event (not in the DOM typings). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallMode =
  /** Running as an installed app. */
  | 'installed'
  /** The browser offered `beforeinstallprompt`: we can prompt. */
  | 'prompt'
  /** iOS Safari: no prompt API, show the "Add to Home Screen" instructions. */
  | 'ios-instructions'
  /** Nothing to offer (desktop browser without the event, in-app browsers). */
  | 'unavailable'

/**
 * Installing the PWA, offered only where the person looks for it (settings,
 * offline page), never as a pop-up. Android holds the deferred prompt; iOS
 * gets an instruction sheet; an installed app shows nothing.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private readonly document = inject(DOCUMENT)
  private readonly view = this.document.defaultView
  private readonly deferred = signal<BeforeInstallPromptEvent | null>(null)
  private readonly standaloneState = signal(this.detectStandalone())

  /** Running from the home screen (`display-mode: standalone`). */
  readonly standalone = this.standaloneState.asReadonly()
  readonly ios = this.detectIos()

  readonly mode = computed<InstallMode>(() => {
    if (this.standaloneState()) {
      return 'installed'
    }
    if (this.deferred()) {
      return 'prompt'
    }
    return this.ios ? 'ios-instructions' : 'unavailable'
  })

  constructor() {
    this.view?.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      this.deferred.set(event as BeforeInstallPromptEvent)
    })
    this.view?.addEventListener('appinstalled', () => {
      this.deferred.set(null)
      this.standaloneState.set(true)
    })
  }

  /** Shows the browser's install prompt; the outcome is the person's choice. */
  async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = this.deferred()
    if (!event) {
      return 'unavailable'
    }
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') {
      this.deferred.set(null)
    }
    return outcome
  }

  private detectStandalone(): boolean {
    const navigator = this.view?.navigator as (Navigator & { standalone?: boolean }) | undefined
    return (
      this.view?.matchMedia?.('(display-mode: standalone)').matches === true ||
      navigator?.standalone === true
    )
  }

  private detectIos(): boolean {
    const navigator = this.view?.navigator
    return navigator ? isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints) : false
  }
}
