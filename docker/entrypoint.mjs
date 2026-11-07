/**
 * Container entrypoint (copied next to the compiled API, see Dockerfile).
 *
 * 1. MIGRATE_ON_START=true -> `node ace migration:run --force`. Safe with one
 *    replica and start-first updates because migrations are additive. If it
 *    fails, the server never starts and the process exits non-zero, so the
 *    deployment rolls back. With several replicas, set it to false and
 *    migrate out of band.
 * 2. SEED_USERS=true -> production bootstrap of the owner/partner accounts
 *    from SEED_* env vars. Not implemented yet (no users table): a no-op.
 * 3. Start the HTTP server in this same process, so SIGTERM reaches AdonisJS.
 */
import { spawnSync } from 'node:child_process'

const appRoot = import.meta.dirname

function isEnabled(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] ?? '').toLowerCase())
}

function ace(...args) {
  console.log(`entrypoint: node ace ${args.join(' ')}`)
  const result = spawnSync(process.execPath, ['ace', ...args], { cwd: appRoot, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`entrypoint: "node ace ${args.join(' ')}" failed, refusing to start`)
    process.exit(result.status ?? 1)
  }
}

if (isEnabled('MIGRATE_ON_START')) {
  ace('migration:run', '--force')
}

if (isEnabled('SEED_USERS')) {
  // TODO(WP 0.5): run the idempotent production bootstrap seeder here
  // (`ace db:seed --files=./database/seeders/production_bootstrap_seeder.js`)
  // once the users table exists. Until then there is nothing to seed.
  console.warn('entrypoint: SEED_USERS is on but the bootstrap seeder arrives with WP 0.5; skipping')
}

await import('./bin/server.js')
