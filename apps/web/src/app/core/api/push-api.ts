import { inject, InjectionToken } from '@angular/core'
import type {
  PushSubscription,
  PushTestResult,
  RegisterPushSubscriptionInput,
} from '@monkitrips/shared'
import { API } from './api'
import { RealPushApi } from './real-push-api'

/**
 * The signed-in person's push subscriptions: register this browser's
 * subscription (the server upserts by endpoint), forget it, and send the
 * test message to every device of the account. The VAPID public key comes
 * with `AuthApi.config()`.
 */
export interface PushApi {
  register(input: RegisterPushSubscriptionInput): Promise<PushSubscription>
  unregister(id: string): Promise<void>
  sendTest(): Promise<PushTestResult>
}

export const PUSH_API = new InjectionToken<PushApi>('PUSH_API', {
  providedIn: 'root',
  factory: () => new RealPushApi(inject(API)),
})
