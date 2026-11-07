import type {
  PushSubscription,
  PushTestResult,
  RegisterPushSubscriptionInput,
} from '@monkitrips/shared'
import type { PushApi } from '../app/core/api/push-api'
import { FakeApi } from './fake-api'

/** In-memory stand-in: keeps the registered subscriptions by endpoint. */
export class FakePushApi extends FakeApi implements PushApi {
  readonly subscriptions = new Map<string, PushSubscription & { deviceLabel: string | null }>()
  testResult: PushTestResult = { sent: 1, pruned: 0, failed: 0 }

  register(input: RegisterPushSubscriptionInput): Promise<PushSubscription> {
    return this.run(`register:${input.endpoint}`, () => {
      const existing = this.subscriptions.get(input.endpoint)
      const subscription: PushSubscription = {
        id: existing?.id ?? `sub-${this.subscriptions.size + 1}`,
        endpoint: input.endpoint,
        deviceLabel: input.deviceLabel ?? null,
        createdAt: '2026-11-07T12:00:00.000Z',
      }
      this.subscriptions.set(input.endpoint, subscription)
      return subscription
    })
  }

  unregister(id: string): Promise<void> {
    return this.run(`unregister:${id}`, () => {
      for (const [endpoint, subscription] of this.subscriptions) {
        if (subscription.id === id) this.subscriptions.delete(endpoint)
      }
    })
  }

  sendTest(): Promise<PushTestResult> {
    return this.run('sendTest', () => this.testResult)
  }
}
