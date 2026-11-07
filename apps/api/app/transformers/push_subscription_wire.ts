import type { PushSubscription as PushSubscriptionWire } from '@monkitrips/shared'
import type PushSubscription from '#models/push_subscription'

/** A subscription as its owner sees it: the keys stay on the server. */
export function toPushSubscriptionWire(subscription: PushSubscription): PushSubscriptionWire {
  return {
    id: subscription.id,
    endpoint: subscription.endpoint,
    deviceLabel: subscription.deviceLabel,
    createdAt: subscription.createdAt.toISO()!,
  }
}
