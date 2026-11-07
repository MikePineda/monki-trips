/** A Web Push subscription of one browser, as stored for the signed-in person. */
export interface PushSubscription {
  id: string
  endpoint: string
  deviceLabel: string | null
  createdAt: string
}

/** Body of `POST /api/v1/me/push-subscriptions`: `PushSubscription.toJSON()` plus a label. */
export interface RegisterPushSubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
  deviceLabel?: string
}
