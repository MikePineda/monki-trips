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

/** Answer of `POST /api/v1/me/push-subscriptions/test`: what happened to the caller's subscriptions. */
export interface PushTestResult {
  /** Subscriptions the push service accepted the message for. */
  sent: number
  /** Subscriptions removed because the push service answered 404 or 410 (gone). */
  pruned: number
  /** Subscriptions that failed for another reason; they stay and count a failure. */
  failed: number
}

/**
 * The JSON every push message carries. The service worker (`sw.js`) shows
 * `title`/`body` under `tag` (a repeated tag replaces the earlier
 * notification) and opens `url` (a path on the app's origin) on tap. Texts
 * arrive in the recipient's locale.
 */
export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}
