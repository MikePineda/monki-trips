import { inject } from '@adonisjs/core'
import type { PushPayload, PushTestResult } from '@monkitrips/shared'
import { DateTime } from 'luxon'
import PushSubscription from '#models/push_subscription'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { PushSender } from '#services/push_sender'

/**
 * Delivers one payload to every subscription of an account and keeps the
 * table honest: a subscription the push service reports gone (404, 410) is
 * deleted on the spot, any other failure counts in `failures` (the prune
 * job reads it later), a success stamps `last_used_at`.
 */
@inject()
export class PushNotifications {
  constructor(
    private readonly sender: PushSender,
    private readonly clock: Clock
  ) {}

  async sendToUser(user: User, payload: PushPayload): Promise<PushTestResult> {
    const subscriptions = await PushSubscription.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'asc')
    const result: PushTestResult = { sent: 0, pruned: 0, failed: 0 }
    for (const subscription of subscriptions) {
      const delivery = await this.sender.send(subscription, payload)
      switch (delivery.status) {
        case 'sent':
          subscription.lastUsedAt = DateTime.fromJSDate(this.clock.now())
          await subscription.save()
          result.sent += 1
          break
        case 'gone':
          await subscription.delete()
          result.pruned += 1
          break
        case 'failed':
          subscription.failures += 1
          await subscription.save()
          result.failed += 1
          break
      }
    }
    return result
  }
}
