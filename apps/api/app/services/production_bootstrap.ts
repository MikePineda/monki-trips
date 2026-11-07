import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { Locale } from '@monkitrips/shared'
import User from '#models/user'
import { Clock } from '#services/clock'
import { normalizeEmail } from '#domain/normalize_email'

export interface BootstrapAccount {
  email: string
  password: string
}

export interface BootstrapInput {
  owner: BootstrapAccount
  partner?: BootstrapAccount
  locale: Locale
}

export interface BootstrapResult {
  created: string[]
  skipped: string[]
}

/**
 * First-deploy accounts, driven by `SEED_*` (the seeder passes them in).
 * Both are created verified and on the `pro` plan; no trip is created, the
 * owner imports the real one through the UI. Idempotent by e-mail: an
 * existing account is left untouched, password included.
 */
@inject()
export class ProductionBootstrap {
  constructor(private readonly clock: Clock) {}

  async run(input: BootstrapInput): Promise<BootstrapResult> {
    const result: BootstrapResult = { created: [], skipped: [] }
    const accounts = [
      { role: 'owner', account: input.owner },
      ...(input.partner ? [{ role: 'partner', account: input.partner }] : []),
    ]
    for (const { role, account } of accounts) {
      const email = normalizeEmail(account.email)
      if (await User.findBy('email', email)) {
        result.skipped.push(role)
        continue
      }
      await User.create({
        email,
        password: account.password,
        displayName: role === 'owner' ? 'Owner' : 'Partner',
        locale: input.locale,
        plan: 'pro',
        emailVerifiedAt: DateTime.fromJSDate(this.clock.now()),
      })
      result.created.push(role)
    }
    return result
  }
}
