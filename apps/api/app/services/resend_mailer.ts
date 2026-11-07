import { Mailer, type MailMessage } from '#services/mailer'

/**
 * `MAIL_DRIVER=resend`: sends through the Resend REST API with Node's fetch.
 * The key never leaves this class and never reaches the logs; a failed send
 * throws so the caller decides (verification mails are retried by the person
 * with "resend").
 */
export class ResendMailer extends Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly endpoint = 'https://api.resend.com/emails'
  ) {
    super()
  }

  async send(message: MailMessage): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    })
    if (!response.ok) {
      throw new Error(`resend: the API answered ${response.status}`)
    }
  }
}
