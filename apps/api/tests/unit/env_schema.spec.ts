import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { envSchema, validateEnv } from '#start/env_schema'

/** Variable names assigned in an env file (`NAME=` lines, commented or not). */
async function assignedNames(path: string): Promise<string[]> {
  const text = await readFile(path, 'utf8')
  return [...text.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1])
}

/** A complete set of valid, fake values for every required variable. */
const REQUIRED = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3333',
  LOG_LEVEL: 'info',
  APP_KEY: 'test-key-not-real-0123456789abcdef',
  APP_URL: 'http://localhost:3333',
  REGISTRATION_OPEN: 'false',
  SESSION_DRIVER: 'cookie',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_USER: 'monkitrips',
  DB_PASSWORD: 'monkitrips',
  DB_DATABASE: 'monkitrips',
}

test.group('Environment schema', () => {
  test('every env var of start/env.ts is documented in .env.example', async ({ assert }) => {
    const documented = await assignedNames(app.makePath('.env.example'))
    const missing = Object.keys(envSchema).filter((name) => !documented.includes(name))

    assert.deepEqual(missing, [])
  })

  test('.env.example documents no variable the app does not read', async ({ assert }) => {
    const documented = await assignedNames(app.makePath('.env.example'))
    const unknown = documented.filter((name) => !(name in envSchema))

    assert.deepEqual(unknown, [])
  })

  test('the self-host example sets only variables the app reads', async ({ assert }) => {
    const names = await assignedNames(app.makePath('../../.env.selfhost.example'))
    const unknown = names.filter((name) => !(name in envSchema))

    assert.isNotEmpty(names)
    assert.deepEqual(unknown, [])
  })

  test('a complete set of required values boots', ({ assert }) => {
    const env = validateEnv(REQUIRED)

    assert.equal(env.PORT, 3333)
    assert.isFalse(env.REGISTRATION_OPEN)
    assert.equal(env.APP_KEY.release(), REQUIRED.APP_KEY)
  })

  test('boot fails on a missing required variable and names it', ({ assert }) => {
    const withoutAppKey: Record<string, string> = { ...REQUIRED }
    delete withoutAppKey.APP_KEY

    assert.throws(() => validateEnv(withoutAppKey), /APP_KEY/)
  })

  test('boot fails on a malformed value', ({ assert }) => {
    assert.throws(() => validateEnv({ ...REQUIRED, PORT: 'not-a-number' }), /PORT/)
    assert.throws(() => validateEnv({ ...REQUIRED, LLM_PROVIDER: 'mystery' }), /LLM_PROVIDER/)
  })

  test('secrets never print their value', ({ assert }) => {
    const env = validateEnv(REQUIRED)

    assert.notInclude(String(env.APP_KEY), REQUIRED.APP_KEY)
    assert.notInclude(JSON.stringify({ key: env.DB_PASSWORD }), REQUIRED.DB_PASSWORD)
  })

  test('no variable is typed as a list or an object', ({ assert }) => {
    const env = validateEnv({ ...REQUIRED, SEED_OWNER_EMAIL: 'owner@example.com' })
    const structured = Object.entries(env).filter(
      ([name, value]) =>
        name in envSchema && typeof value === 'object' && value !== null && !('release' in value)
    )

    assert.deepEqual(structured, [])
  })
})
