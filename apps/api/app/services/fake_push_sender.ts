import type { PushPayload } from '@monkitrips/shared'
import { PushSender, type PushDelivery, type PushTarget } from '#services/push_sender'

/** One recorded send. */
export interface RecordedPush {
  endpoint: string
  payload: PushPayload
}

/**
 * `PushSender` that sends nothing: it records every message and answers
 * what a spec scripted for the endpoint (`answerWith(endpoint, 410)`), or
 * `sent`. Bound by the provider when the VAPID keys are empty (development,
 * self-hosting without push) and under `NODE_ENV=test`.
 */
export class FakePushSender extends PushSender {
  readonly sent: RecordedPush[] = []
  readonly #answers = new Map<string, number>()

  /** From now on, the push service answers `statusCode` for `endpoint`. */
  answerWith(endpoint: string, statusCode: number): void {
    this.#answers.set(endpoint, statusCode)
  }

  /** Forgets every recorded send and scripted answer. */
  reset(): void {
    this.sent.length = 0
    this.#answers.clear()
  }

  /** Messages sent to `endpoint`, oldest first. */
  sentTo(endpoint: string): PushPayload[] {
    return this.sent.filter((push) => push.endpoint === endpoint).map((push) => push.payload)
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushDelivery> {
    this.sent.push({ endpoint: target.endpoint, payload })
    const statusCode = this.#answers.get(target.endpoint)
    if (statusCode === undefined || (statusCode >= 200 && statusCode < 300)) {
      return { status: 'sent' }
    }
    return statusCode === 404 || statusCode === 410
      ? { status: 'gone', statusCode }
      : { status: 'failed', statusCode }
  }
}
