import { sendNotification, WebPushError } from 'web-push'
import type { PushPayload } from '@monkitrips/shared'
import { PushSender, type PushDelivery, type PushTarget } from '#services/push_sender'
import type { VapidConfig } from '#services/vapid_config'

/** Statuses after which a push service will never deliver to the endpoint again. */
const GONE_STATUSES = new Set([404, 410])

/**
 * `PushSender` over the `web-push` library (RFC 8291 encryption, VAPID
 * JWT). The payload travels as JSON; the service worker reads it as a
 * `PushPayload`. The message lives one day at the push service (`TTL`) and
 * the tag doubles as the `Topic` header, so a newer message with the same
 * tag replaces an undelivered older one.
 */
export class WebPushSender extends PushSender {
  constructor(private readonly vapid: VapidConfig) {
    super()
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushDelivery> {
    const vapidDetails = this.vapid.details()
    if (!vapidDetails) {
      return { status: 'failed', statusCode: null }
    }
    try {
      await sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { vapidDetails, TTL: 86_400, topic: topicFor(payload.tag) }
      )
      return { status: 'sent' }
    } catch (error) {
      if (error instanceof WebPushError) {
        return GONE_STATUSES.has(error.statusCode)
          ? { status: 'gone', statusCode: error.statusCode }
          : { status: 'failed', statusCode: error.statusCode }
      }
      return { status: 'failed', statusCode: null }
    }
  }
}

/** A tag as a `Topic` header: URL-safe base64 characters, at most 32. */
function topicFor(tag: string): string {
  return tag.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32)
}
