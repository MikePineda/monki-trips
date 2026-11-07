import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import type { NotificationPermissionState } from '../../domain/push-availability'

/** The part of a browser `PushSubscription` the app needs. */
export interface BrowserPushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
  unsubscribe(): Promise<boolean>
}

/**
 * The browser's push surface behind one small interface, so the service
 * stays testable: specs provide a fake, production reads `window`.
 */
export interface PushBrowser {
  /** Service worker, Push API and Notification API all present. */
  supported(): boolean
  permission(): NotificationPermissionState
  /**
   * Whether the call runs inside a user gesture (`navigator.userActivation`).
   * Browsers that do not expose it answer true: they enforce it themselves.
   */
  userActivated(): boolean
  requestPermission(): Promise<NotificationPermissionState>
  subscribe(applicationServerKey: Uint8Array): Promise<BrowserPushSubscription>
  currentSubscription(): Promise<BrowserPushSubscription | null>
}

/** How long to wait for the service worker to become active before giving up. */
export const SERVICE_WORKER_READY_MS = 20_000

export const PUSH_BROWSER = new InjectionToken<PushBrowser>('PUSH_BROWSER', {
  providedIn: 'root',
  factory: () => new WindowPushBrowser(inject(DOCUMENT).defaultView),
})

/** `window` with the globals the DOM typings do not list as properties. */
type PushCapableWindow = Window & {
  Notification?: typeof Notification
  navigator: Navigator & { userActivation?: { isActive: boolean } }
}

/** `PushBrowser` over the real `window`. */
export class WindowPushBrowser implements PushBrowser {
  private readonly view: PushCapableWindow | null

  constructor(view: Window | null) {
    this.view = view as PushCapableWindow | null
  }

  supported(): boolean {
    const view = this.view
    return (
      !!view && 'serviceWorker' in view.navigator && 'PushManager' in view && 'Notification' in view
    )
  }

  permission(): NotificationPermissionState {
    return this.view?.Notification?.permission ?? 'denied'
  }

  userActivated(): boolean {
    const activation = this.view?.navigator.userActivation
    return activation ? activation.isActive : true
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    const notification = this.view?.Notification
    if (!notification) return 'denied'
    return notification.requestPermission()
  }

  async subscribe(applicationServerKey: Uint8Array): Promise<BrowserPushSubscription> {
    const registration = await this.readyRegistration()
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    })
    return toBrowserSubscription(subscription)
  }

  async currentSubscription(): Promise<BrowserPushSubscription | null> {
    const registration = await this.view?.navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    return subscription ? toBrowserSubscription(subscription) : null
  }

  /** The active registration, or an error when none becomes active in time (dev mode, a broken install). */
  private async readyRegistration(): Promise<ServiceWorkerRegistration> {
    const container = this.view?.navigator.serviceWorker
    if (!container) throw new Error('push: no service worker container')
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('push: the service worker did not become active')),
        SERVICE_WORKER_READY_MS
      )
    })
    try {
      return await Promise.race([container.ready, timeout])
    } finally {
      clearTimeout(timer)
    }
  }
}

function toBrowserSubscription(subscription: PushSubscription): BrowserPushSubscription {
  const json = subscription.toJSON()
  const keys = json.keys ?? {}
  if (!json.endpoint || !keys['p256dh'] || !keys['auth']) {
    throw new Error('push: the browser returned an incomplete subscription')
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: keys['p256dh'], auth: keys['auth'] },
    unsubscribe: () => subscription.unsubscribe(),
  }
}
