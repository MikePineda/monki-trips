import type { Logger } from '@adonisjs/core/logger'
import { Mailer, type MailMessage } from '#services/mailer'
import { maskEmail } from '#domain/mask_email'

/**
 * `MAIL_DRIVER=log`: the mail goes to the log at info level, masked
 * recipient (`m***@example.com`, never the address) and subject only (the
 * body carries tokens). Development, self-hosting
 * without a mail account and the E2E stack use it.
 */
export class LogMailer extends Mailer {
  constructor(private readonly logger: Logger) {
    super()
  }

  async send(message: MailMessage): Promise<void> {
    this.logger.info(
      { to: maskEmail(message.to), subject: message.subject },
      'mail not sent (MAIL_DRIVER=log)'
    )
  }
}
