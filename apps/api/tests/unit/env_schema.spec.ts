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

  test('empty s3 variables are accepted when drive disk is fs', ({ assert }) => {
    const env = validateEnv({
      ...REQUIRED,
      DRIVE_DISK: 'fs',
      S3_ENDPOINT: '',
      S3_REGION: '',
      S3_BUCKET: '',
      S3_KEY: '',
      S3_SECRET: '',
    })

    assert.equal(env.DRIVE_DISK, 'fs')
  })

  test('s3 endpoint is required when drive disk is s3', ({ assert }) => {
    const s3 = {
      ...REQUIRED,
      DRIVE_DISK: 's3',
      S3_ENDPOINT: 'http://127.0.0.1:9030',
      S3_REGION: 'auto',
      S3_BUCKET: 'monkitrips',
      S3_KEY: 'fake-key',
      S3_SECRET: 'fake-secret',
    }

    assert.equal(validateEnv(s3).DRIVE_DISK, 's3')
    assert.throws(() => validateEnv({ ...s3, S3_ENDPOINT: '' }), /S3_ENDPOINT/)
    assert.throws(() => validateEnv({ ...s3, S3_KEY: '', S3_SECRET: '' }), /S3_KEY[\s\S]*S3_SECRET/)
  })

  test('the resend key may stay empty while mail only goes to the log', ({ assert }) => {
    assert.equal(
      validateEnv({ ...REQUIRED, MAIL_DRIVER: 'log', RESEND_API_KEY: '' }).MAIL_DRIVER,
      'log'
    )
    assert.throws(
      () => validateEnv({ ...REQUIRED, MAIL_DRIVER: 'resend', RESEND_API_KEY: '' }),
      /RESEND_API_KEY/
    )
  })

  test('the llm key may stay empty with the fake provider', ({ assert }) => {
    assert.equal(
      validateEnv({ ...REQUIRED, LLM_PROVIDER: 'fake', LLM_API_KEY: '' }).LLM_PROVIDER,
      'fake'
    )
    assert.throws(
      () => validateEnv({ ...REQUIRED, LLM_PROVIDER: 'anthropic', LLM_API_KEY: '' }),
      /LLM_API_KEY/
    )
  })

  test('vapid variables are accepted empty, together, and refused half set', ({ assert }) => {
    const empty = validateEnv({
      ...REQUIRED,
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      VAPID_SUBJECT: '',
    })
    assert.isUndefined(empty.VAPID_PUBLIC_KEY)

    const complete = validateEnv({
      ...REQUIRED,
      VAPID_PUBLIC_KEY: 'public-key',
      VAPID_PRIVATE_KEY: 'private-key',
      VAPID_SUBJECT: 'mailto:admin@example.com',
    })
    assert.equal(complete.VAPID_SUBJECT, 'mailto:admin@example.com')
    assert.notInclude(String(complete.VAPID_PRIVATE_KEY), 'private-key')

    assert.throws(
      () => validateEnv({ ...REQUIRED, VAPID_PUBLIC_KEY: 'public-key' }),
      /VAPID_PRIVATE_KEY[\s\S]*VAPID_SUBJECT/
    )
    assert.throws(
      () => validateEnv({ ...REQUIRED, VAPID_PRIVATE_KEY: 'private-key', VAPID_SUBJECT: '' }),
      /VAPID_PUBLIC_KEY/
    )
  })

  test('the scheduler switch accepts on and off only', ({ assert }) => {
    assert.equal(validateEnv({ ...REQUIRED, SCHEDULER: 'off' }).SCHEDULER, 'off')
    assert.throws(() => validateEnv({ ...REQUIRED, SCHEDULER: 'sometimes' }), /SCHEDULER/)
  })

  test('a dependent-variable error never echoes a secret value', ({ assert }) => {
    try {
      validateEnv({ ...REQUIRED, DRIVE_DISK: 's3', S3_KEY: 'very-secret-key-value' })
      assert.fail('should have thrown')
    } catch (error) {
      assert.notInclude((error as Error).message, 'very-secret-key-value')
    }
  })
})
