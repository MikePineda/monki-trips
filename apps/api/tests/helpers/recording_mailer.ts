import app from '@adonisjs/core/services/app'
import type { Group } from '@japa/runner/core'
import { Mailer, type MailMessage } from '#services/mailer'

/** `Mail::fake()`: keeps every message so specs can read tokens and codes out of it. */
export class RecordingMailer extends Mailer {
  readonly sent: MailMessage[] = []

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message)
  }

  /** The last message sent to `to`, or throws. */
  lastTo(to: string): MailMessage {
    const message = [...this.sent].reverse().find((candidate) => candidate.to === to)
    if (!message) throw new Error(`no mail was sent to ${to}`)
    return message
  }
}

/** Swaps the mailer for a recorder during every test of the group and returns it. */
export function useRecordingMailer(group: Group): RecordingMailer {
  const mailer = new RecordingMailer()
  group.each.setup(() => {
    mailer.sent.length = 0
    app.container.swap(Mailer, () => mailer)
    return () => app.container.restore(Mailer)
  })
  return mailer
}

/** Pulls `?token=<value>` out of the first URL in a mail body. */
export function tokenFromMail(message: MailMessage): string {
  const match = message.text.match(/[?&]token=([A-Za-z0-9_%-]+)/)
  if (!match) throw new Error('the mail carries no token link')
  return decodeURIComponent(match[1])
}

/** Pulls the 6-digit code out of a verification mail. */
export function codeFromMail(message: MailMessage): string {
  const match = message.text.match(/\b(\d{6})\b/)
  if (!match) throw new Error('the mail carries no 6-digit code')
  return match[1]
}
