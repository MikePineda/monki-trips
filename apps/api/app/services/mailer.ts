/** A plain-text transactional mail. Rendering happens in the caller, in the recipient's locale. */
export interface MailMessage {
  to: string
  subject: string
  text: string
}

/**
 * Outgoing mail. The container binds the implementation chosen by
 * `MAIL_DRIVER` (`providers/mail_provider.ts`): `log` writes to the log and
 * sends nothing, `resend` calls the Resend API. Tests swap in a recorder.
 */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>
}
