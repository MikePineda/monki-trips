import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import { normalizeEmail } from '#domain/normalize_email'
import { PushMessages } from '#services/push_messages'
import { PushNotifications } from '#services/push_notifications'
import { VapidConfig } from '#services/vapid_config'

/**
 * `node ace push:test --user <id or e-mail>`: sends the "notifications
 * work" message to every subscription of one account, the same path as
 * the Settings button, and reports what the push service answered.
 */
export default class PushTest extends BaseCommand {
  static commandName = 'push:test'
  static description = 'Send a test notification to every device of an account'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Account id (uuid) or e-mail address', required: true })
  declare user: string

  async run() {
    const vapid = await this.app.container.make(VapidConfig)
    if (!vapid.enabled) {
      this.logger.error(
        'push is disabled: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT'
      )
      this.exitCode = 1
      return
    }
    const user = this.user.includes('@')
      ? await User.findBy('email', normalizeEmail(this.user))
      : await User.find(this.user)
    if (!user) {
      this.logger.error('no account matches --user')
      this.exitCode = 1
      return
    }
    const notifications = await this.app.container.make(PushNotifications)
    const messages = await this.app.container.make(PushMessages)
    const result = await notifications.sendToUser(user, messages.test(user.locale))
    this.logger.success(
      `sent ${result.sent}, pruned ${result.pruned} (gone), failed ${result.failed}`
    )
  }
}
