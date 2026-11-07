import type { PushPayload } from '@monkitrips/shared'

/** What a push service needs to reach one browser: the stored subscription. */
export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * The outcome of one delivery attempt. `gone` means the push service no
 * longer knows the subscription (404 or 410): the caller deletes it.
 * `failed` is anything else (network, 5xx, a bad key): the subscription
 * stays and counts a failure.
 */
export type PushDelivery =
  | { status: 'sent' }
  | { status: 'gone'; statusCode: number }
  | { status: 'failed'; statusCode: number | null }

/**
 * Sends Web Push messages. The container binds the implementation
 * (`providers/push_provider.ts`): `WebPushSender` with the VAPID keys from
 * env, or `FakePushSender` (records, sends nothing) when the keys are empty
 * or under `NODE_ENV=test`. Specs read the fake back from the container.
 */
export abstract class PushSender {
  abstract send(target: PushTarget, payload: PushPayload): Promise<PushDelivery>
}
