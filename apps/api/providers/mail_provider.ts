import type { ApplicationService } from '@adonisjs/core/types'
import { Mailer } from '#services/mailer'

/**
 * Binds the `Mailer` implementation chosen by `MAIL_DRIVER`. Resolved
 * lazily so the env is validated first and tests can swap the binding.
 */
export default class MailProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(Mailer, async () => {
      const { default: env } = await import('#start/env')
      const logger = await this.app.container.make('logger')
      if (env.get('MAIL_DRIVER') === 'resend') {
        const { ResendMailer } = await import('#services/resend_mailer')
        return new ResendMailer(env.get('RESEND_API_KEY')!.release(), env.get('MAIL_FROM')!)
      }
      const { LogMailer } = await import('#services/log_mailer')
      return new LogMailer(logger)
    })
  }
}
