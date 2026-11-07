import { BaseSeeder } from '@adonisjs/lucid/seeders'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { ProductionBootstrap } from '#services/production_bootstrap'

/**
 * First-deploy accounts from `SEED_OWNER_*`, `SEED_PARTNER_*` and
 * `SEED_LOCALE` (docker/entrypoint.mjs runs it when `SEED_USERS=true`).
 * Idempotent: existing accounts are left alone. Without the owner variables
 * it does nothing, so leaving `SEED_USERS` on never fails a start.
 */
export default class extends BaseSeeder {
  async run() {
    const ownerEmail = env.get('SEED_OWNER_EMAIL')
    const ownerPassword = env.get('SEED_OWNER_PASSWORD')?.release()
    if (!ownerEmail || !ownerPassword) {
      console.log(
        'production_bootstrap: SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD not set, nothing to seed'
      )
      return
    }
    const partnerEmail = env.get('SEED_PARTNER_EMAIL')
    const partnerPassword = env.get('SEED_PARTNER_PASSWORD')?.release()

    const bootstrap = await app.container.make(ProductionBootstrap)
    const result = await bootstrap.run({
      owner: { email: ownerEmail, password: ownerPassword },
      partner:
        partnerEmail && partnerPassword
          ? { email: partnerEmail, password: partnerPassword }
          : undefined,
      locale: env.get('SEED_LOCALE') ?? 'en',
    })
    console.log(
      `production_bootstrap: created [${result.created.join(', ')}] skipped [${result.skipped.join(', ')}]`
    )
  }
}
