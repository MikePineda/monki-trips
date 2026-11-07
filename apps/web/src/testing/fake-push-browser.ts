import type { NotificationPermissionState } from '../app/domain/push-availability'
import type { BrowserPushSubscription, PushBrowser } from '../app/core/push/push-browser'

/**
 * A browser push surface a spec scripts: support, the permission and what
 * the prompt answers, whether a gesture is active, and the subscription
 * the push service would hand out. Records what the app asked for.
 */
export class FakePushBrowser implements PushBrowser {
  isSupported = true
  currentPermission: NotificationPermissionState = 'default'
  promptAnswer: NotificationPermissionState = 'granted'
  gestureActive = true
  endpoint = 'https://push.example.com/send/fake-device'
  subscription: BrowserPushSubscription | null = null
  readonly calls: string[] = []
  /** `applicationServerKey` bytes of the last subscribe. */
  lastServerKey: Uint8Array | null = null

  supported(): boolean {
    return this.isSupported
  }

  permission(): NotificationPermissionState {
    return this.currentPermission
  }

  userActivated(): boolean {
    return this.gestureActive
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    this.calls.push('requestPermission')
    this.currentPermission = this.promptAnswer
    return this.promptAnswer
  }

  async subscribe(applicationServerKey: Uint8Array): Promise<BrowserPushSubscription> {
    this.calls.push('subscribe')
    this.lastServerKey = applicationServerKey
    this.subscription = {
      endpoint: this.endpoint,
      keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' },
      unsubscribe: async () => {
        this.calls.push('unsubscribe')
        this.subscription = null
        return true
      },
    }
    return this.subscription
  }

  async currentSubscription(): Promise<BrowserPushSubscription | null> {
    return this.subscription
  }
}
