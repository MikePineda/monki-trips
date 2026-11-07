import { Injectable, computed, inject, signal } from '@angular/core'
import { AUTH_API } from '../api/auth-api'
import { PUSH_API } from '../api/push-api'
import { MetaStore } from '../offline/meta.store'
import { InstallService } from '../pwa/install.service'
import {
  applicationServerKey,
  pushAvailability,
  type NotificationPermissionState,
} from '../../domain/push-availability'
import { PUSH_BROWSER } from './push-browser'

/** Meta keys: the server-side id of this browser's subscription and its endpoint. */
export const META_PUSH_SUBSCRIPTION = 'push.subscriptionId'
export const META_PUSH_ENDPOINT = 'push.endpoint'

export type PushStatus =
  /** This browser cannot receive push. */
  | 'unsupported'
  /** iOS in a tab: install the app first. */
  | 'ios-install'
  /** Notifications refused in the browser; only its settings can undo that. */
  | 'blocked'
  /** The server has no VAPID keys. */
  | 'server-off'
  /** Can be enabled. */
  | 'off'
  /** This device is registered. */
  | 'enabled'

export type EnableOutcome =
  | 'enabled'
  /** Called outside a user gesture: the permission prompt would be refused or hidden. */
  | 'needs-gesture'
  /** The person refused the prompt. */
  | 'denied'
  /** Nothing to do here (unsupported, iOS tab, server without keys). */
  | 'unavailable'

/**
 * Notifications on this device. Feature detection (including the iOS
 * "installed app only" rule), the permission prompt strictly from a user
 * gesture, the subscription with the server's VAPID key, its registration
 * (the id lives in Dexie `meta`), unsubscribing, and the test message.
 * The server's `pushEnabled` is read once, lazily, from `/config`.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly browser = inject(PUSH_BROWSER)
  private readonly install = inject(InstallService)
  private readonly meta = inject(MetaStore)
  private readonly pushApi = inject(PUSH_API)
  private readonly authApi = inject(AUTH_API)

  private readonly permission = signal<NotificationPermissionState>(this.browser.permission())
  /** `null` until `/config` answered. */
  private readonly serverEnabled = signal<boolean | null>(null)
  private readonly vapidPublicKey = signal<string | null>(null)
  private readonly working = signal(false)
  private readonly subscriptionId = this.meta.watch<string | null>(META_PUSH_SUBSCRIPTION, null)
  private configLoading: Promise<void> | null = null

  readonly busy = this.working.asReadonly()
  /** Whether the server can send at all; null while unknown. */
  readonly serverPushEnabled = this.serverEnabled.asReadonly()

  readonly availability = computed(() =>
    pushAvailability({
      supported: this.browser.supported(),
      ios: this.install.ios,
      standalone: this.install.standalone(),
      permission: this.permission(),
    })
  )

  readonly status = computed<PushStatus>(() => {
    const availability = this.availability()
    if (availability !== 'available') {
      return availability
    }
    if (this.serverEnabled() === false) {
      return 'server-off'
    }
    return this.permission() === 'granted' && this.subscriptionId() ? 'enabled' : 'off'
  })

  /** Reads `pushEnabled` and the VAPID key from `/config` (once; a failure leaves them unknown). */
  loadConfig(): Promise<void> {
    this.configLoading ??= this.authApi
      .config()
      .then((config) => {
        this.serverEnabled.set(config.pushEnabled)
        this.vapidPublicKey.set(config.vapidPublicKey)
      })
      .catch(() => {
        this.configLoading = null
      })
    return this.configLoading
  }

  /**
   * Enables notifications on this device. Must run inside a user gesture
   * (a tap on the toggle): otherwise it answers `needs-gesture` and asks
   * for nothing. The label names the device in the account's list.
   */
  async enable(deviceLabel?: string): Promise<EnableOutcome> {
    if (this.availability() !== 'available') {
      return 'unavailable'
    }
    if (!this.browser.userActivated()) {
      return 'needs-gesture'
    }
    this.working.set(true)
    try {
      const permission = await this.browser.requestPermission()
      this.permission.set(permission)
      if (permission !== 'granted') {
        return 'denied'
      }
      await this.loadConfig()
      const key = this.vapidPublicKey()
      if (!key) {
        return 'unavailable'
      }
      const subscription =
        (await this.browser.currentSubscription()) ??
        (await this.browser.subscribe(applicationServerKey(key)))
      const registered = await this.pushApi.register({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        ...(deviceLabel?.trim() ? { deviceLabel: deviceLabel.trim() } : {}),
      })
      await this.meta.set(META_PUSH_SUBSCRIPTION, registered.id)
      await this.meta.set(META_PUSH_ENDPOINT, registered.endpoint)
      return 'enabled'
    } finally {
      this.working.set(false)
    }
  }

  /** Unsubscribes this browser and forgets the registration on both sides. */
  async disable(): Promise<void> {
    this.working.set(true)
    try {
      const subscription = await this.browser.currentSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
      const id = await this.meta.get<string>(META_PUSH_SUBSCRIPTION)
      if (id) {
        await this.pushApi.unregister(id)
      }
      await this.meta.remove(META_PUSH_SUBSCRIPTION)
      await this.meta.remove(META_PUSH_ENDPOINT)
    } finally {
      this.working.set(false)
    }
  }

  /** The "notifications work" message to every device of the account; failures are ApiFailures. */
  sendTest() {
    return this.pushApi.sendTest()
  }
}
