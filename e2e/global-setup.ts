import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * Creates the suite's accounts on the run's database through the API's own
 * production bootstrap seeder (verified, `pro`, no trips), the same command
 * the container runs with `SEED_USERS=true`. The seeder takes one owner and
 * one optional partner per run and is idempotent by e-mail, so it runs
 * twice: owner + partner (J11), then the solo traveller (J01).
 *
 * The API build and the database are up by now: scripts/e2e.sh migrated the
 * database and exported the slot's ports before starting Playwright.
 */
export default function globalSetup(): void {
  const apiBuild = fileURLToPath(new URL('../apps/api/build', import.meta.url))
  const runs = [
    {
      SEED_OWNER_EMAIL: process.env.E2E_OWNER_EMAIL,
      SEED_OWNER_PASSWORD: process.env.E2E_OWNER_PASSWORD,
      SEED_PARTNER_EMAIL: process.env.E2E_PARTNER_EMAIL,
      SEED_PARTNER_PASSWORD: process.env.E2E_PARTNER_PASSWORD,
    },
    {
      SEED_OWNER_EMAIL: process.env.E2E_SOLO_EMAIL,
      SEED_OWNER_PASSWORD: process.env.E2E_SOLO_PASSWORD,
      SEED_PARTNER_EMAIL: '',
      SEED_PARTNER_PASSWORD: '',
    },
  ]
  for (const seed of runs) {
    for (const [name, value] of Object.entries(seed)) {
      if (value === undefined) {
        throw new Error(`${name} has no value: e2e/e2e.env defines the suite's accounts`)
      }
    }
    const env: NodeJS.ProcessEnv = { ...process.env, ...seed, SEED_LOCALE: 'en' }
    // The seeder treats an empty partner address as "no partner".
    if (!seed.SEED_PARTNER_EMAIL) {
      delete env.SEED_PARTNER_EMAIL
      delete env.SEED_PARTNER_PASSWORD
    }
    const output = execFileSync(
      'node',
      ['ace', 'db:seed', '--files=./database/seeders/production_bootstrap_seeder.js'],
      { cwd: apiBuild, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
    )
    if (!/production_bootstrap: created/.test(output)) {
      throw new Error(`the bootstrap seeder did not report what it did:\n${output}`)
    }
  }
}
