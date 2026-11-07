import { BaseSeeder } from '@adonisjs/lucid/seeders'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { DemoTrip } from '#services/demo_trip'
import { ProductionBootstrap } from '#services/production_bootstrap'

/**
 * The synthetic "Demo Loop" trip for development and E2E: 18 days, base
 * AUD, expenses in THB and JPY, an overnight train, the last night on a
 * plane, one night without lodging on purpose, a PDF tagged `print`, a
 * two-segment flight with per-traveller seats, overdue and high tasks.
 *
 * Accounts come from `SEED_OWNER_*` / `SEED_PARTNER_*` (same as the
 * production bootstrap); without them nothing is seeded. Never runs in
 * production. Idempotent: a trip named "Demo Loop" owned by the owner is
 * left alone.
 */
export default class extends BaseSeeder {
  static environment = ['development', 'testing']

  async run() {
    const ownerEmail = env.get('SEED_OWNER_EMAIL')
    const ownerPassword = env.get('SEED_OWNER_PASSWORD')?.release()
    if (!ownerEmail || !ownerPassword) {
      console.log('demo_trip: SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD not set, nothing to seed')
      return
    }
    const partnerEmail = env.get('SEED_PARTNER_EMAIL')
    const partnerPassword = env.get('SEED_PARTNER_PASSWORD')?.release()
    const bootstrap = await app.container.make(ProductionBootstrap)
    await bootstrap.run({
      owner: { email: ownerEmail, password: ownerPassword },
      partner:
        partnerEmail && partnerPassword
          ? { email: partnerEmail, password: partnerPassword }
          : undefined,
      locale: env.get('SEED_LOCALE') ?? 'en',
    })
    const demo = await app.container.make(DemoTrip)
    const result = await demo.seed({ ownerEmail, partnerEmail: partnerEmail || undefined })
    console.log(
      `demo_trip: ${result.created ? 'created' : 'already present'} trip ${result.tripId}`
    )
  }
}
