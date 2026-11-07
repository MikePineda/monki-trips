import type { Logger } from '@adonisjs/core/logger'
import { Mailer, type MailMessage } from '#services/mailer'

/**
 * `MAIL_DRIVER=log`: the mail goes to the log at info level, recipient and
 * subject only (the body carries tokens). Development, self-hosting
 * without a mail account and the E2E stack use it.
 */
export class LogMailer extends Mailer {
  constructor(private readonly logger: Logger) {
    super()
  }

  async send(message: MailMessage): Promise<void> {
    this.logger.info(
      { to: message.to, subject: message.subject },
      'mail not sent (MAIL_DRIVER=log)'
    )
  }
}
