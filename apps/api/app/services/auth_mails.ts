import { inject } from '@adonisjs/core'
import i18nManager from '@adonisjs/i18n/services/main'
import type { Locale } from '@monkitrips/shared'
import { appUrl } from '#config/app'
import type User from '#models/user'
import { Mailer } from '#services/mailer'

/**
 * The mails of the account lifecycle, rendered from
 * `resources/lang/<locale>/mails.json` in the recipient's locale. Links are
 * built from `APP_URL`; the web app owns these paths (docs/CONTRACTS.md).
 */
@inject()
export class AuthMails {
  constructor(private readonly mailer: Mailer) {}

  async sendVerification(user: User, token: string, code: string): Promise<void> {
    const t = i18nManager.locale(user.locale)
    const url = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`
    await this.mailer.send({
      to: user.email,
      subject: t.t('mails.verification.subject'),
      text: t.t('mails.verification.text', { name: user.displayName, url, code }),
    })
  }

  async sendPasswordReset(user: User, token: string): Promise<void> {
    const t = i18nManager.locale(user.locale)
    const url = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
    await this.mailer.send({
      to: user.email,
      subject: t.t('mails.password_reset.subject'),
      text: t.t('mails.password_reset.text', { name: user.displayName, url }),
    })
  }

  async sendInvitation(input: {
    to: string
    tripName: string
    inviterName: string
    url: string
    locale: Locale
  }): Promise<void> {
    const t = i18nManager.locale(input.locale)
    await this.mailer.send({
      to: input.to,
      subject: t.t('mails.invitation.subject', { tripName: input.tripName }),
      text: t.t('mails.invitation.text', {
        tripName: input.tripName,
        inviterName: input.inviterName,
        url: input.url,
      }),
    })
  }
}

/** Absolute URL an invitee opens: the web app's `/invite/:token` screen. */
export function invitationUrl(token: string): string {
  return `${appUrl}/invite/${encodeURIComponent(token)}`
}
