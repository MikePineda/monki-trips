/**
 * The VAPID identity of this deployment, from `VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. Push is enabled only with all
 * three (`start/env_schema.ts` refuses a partial set). The private key
 * never serialises: `toJSON()` and inspection show the public half only.
 */
export class VapidConfig {
  readonly publicKey: string | null
  readonly subject: string | null
  readonly #privateKey: string | null

  constructor(publicKey: string | null, privateKey: string | null, subject: string | null) {
    const complete = !!publicKey && !!privateKey && !!subject
    this.publicKey = complete ? publicKey : null
    this.subject = complete ? subject : null
    this.#privateKey = complete ? privateKey : null
  }

  /** Nothing set: the disabled configuration. */
  static disabled(): VapidConfig {
    return new VapidConfig(null, null, null)
  }

  get enabled(): boolean {
    return this.publicKey !== null
  }

  /** The three values `web-push` signs with, or null while disabled. */
  details(): { subject: string; publicKey: string; privateKey: string } | null {
    if (!this.enabled) return null
    return { subject: this.subject!, publicKey: this.publicKey!, privateKey: this.#privateKey! }
  }

  toJSON(): { enabled: boolean; publicKey: string | null } {
    return { enabled: this.enabled, publicKey: this.publicKey }
  }
}
