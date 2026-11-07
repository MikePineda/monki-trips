/*
|--------------------------------------------------------------------------
| Environment schema
|--------------------------------------------------------------------------
|
| Every variable the app reads, validated at boot (start/env.ts), so a
| missing or malformed value stops the process immediately instead of
| failing at request time. Rules for this file:
|
| - Secrets use `Env.schema.secret()` so they never leak through logs.
| - Booleans are booleans; numbers are numbers.
| - NEVER type a variable as a list or an object: values that carry
|   structure stay flat raw strings and are parsed by the code that owns them.
| - Every key is documented in `apps/api/.env.example`; a unit test fails
|   when one is missing.
|
*/

import { Env } from '@adonisjs/core/env'
import { TRUSTED_PROXIES } from '#domain/client_address'

export const envSchema = {
  // Node / HTTP
  TZ: Env.schema.string.optional(),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number(),
  LOG_LEVEL: Env.schema.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  APP_NAME: Env.schema.string.optional(),
  APP_VERSION: Env.schema.string.optional(),
  GIT_SHA: Env.schema.string.optional(),
  REGISTRATION_OPEN: Env.schema.boolean(),
  APP_DEFAULT_LOCALE: Env.schema.enum.optional(['en', 'es'] as const),
  TRUSTED_PROXY: Env.schema.enum.optional(TRUSTED_PROXIES),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),

  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.secret(),
  DB_DATABASE: Env.schema.string(),
  DB_POOL_MAX: Env.schema.number.optional(),

  // Object storage (S3-compatible)
  DRIVE_DISK: Env.schema.enum.optional(['fs', 's3'] as const),
  S3_ENDPOINT: Env.schema.string.optional({ format: 'url', tld: false }),
  S3_REGION: Env.schema.string.optional(),
  S3_BUCKET: Env.schema.string.optional(),
  S3_KEY: Env.schema.secret.optional(),
  S3_SECRET: Env.schema.secret.optional(),

  // LLM (Anthropic Messages compatible; `openai` is a reserved seam that answers 503)
  LLM_PROVIDER: Env.schema.enum.optional(['fake', 'anthropic', 'openai'] as const),
  LLM_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  LLM_API_KEY: Env.schema.secret.optional(),
  LLM_MODEL: Env.schema.string.optional(),
  LLM_VISION_MODEL: Env.schema.string.optional(),
  LLM_MONTHLY_TOKEN_CAP_OVERRIDE: Env.schema.number.optional(),

  // Other external providers
  FX_PROVIDER: Env.schema.enum.optional(['fake', 'frankfurter'] as const),
  WEATHER_PROVIDER: Env.schema.enum.optional(['fake', 'open-meteo', 'off'] as const),
  FLIGHT_STATUS_PROVIDER: Env.schema.enum.optional(['fake', 'off'] as const),

  // Mail
  MAIL_DRIVER: Env.schema.enum.optional(['log', 'resend'] as const),
  MAIL_FROM: Env.schema.string.optional(),
  RESEND_API_KEY: Env.schema.secret.optional(),

  // Web Push (VAPID). All three or none: push is disabled while they are empty.
  VAPID_PUBLIC_KEY: Env.schema.string.optional(),
  VAPID_PRIVATE_KEY: Env.schema.secret.optional(),
  VAPID_SUBJECT: Env.schema.string.optional(),

  // In-process scheduler: on (default) | off
  SCHEDULER: Env.schema.enum.optional(['on', 'off'] as const),

  // Deploy-time bootstrap (read by docker/entrypoint.mjs and the bootstrap seeder)
  MIGRATE_ON_START: Env.schema.boolean.optional(),
  SEED_USERS: Env.schema.boolean.optional(),
  SEED_OWNER_EMAIL: Env.schema.string.optional(),
  SEED_OWNER_PASSWORD: Env.schema.secret.optional(),
  SEED_PARTNER_EMAIL: Env.schema.string.optional(),
  SEED_PARTNER_PASSWORD: Env.schema.secret.optional(),
  SEED_LOCALE: Env.schema.enum.optional(['en', 'es'] as const),
}

type EnvSchema = typeof envSchema

/**
 * Variables that become required once a driver needs them. While the driver
 * is off (`DRIVE_DISK=fs`, `MAIL_DRIVER=log`, `LLM_PROVIDER=fake`) they may be
 * present and empty, which is how a deployment ships them before the owner
 * fills them in.
 */
const REQUIRED_BY_DRIVER: { when: [string, string]; require: string[] }[] = [
  {
    when: ['DRIVE_DISK', 's3'],
    require: ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_KEY', 'S3_SECRET'],
  },
  { when: ['MAIL_DRIVER', 'resend'], require: ['RESEND_API_KEY', 'MAIL_FROM'] },
  { when: ['LLM_PROVIDER', 'anthropic'], require: ['LLM_API_KEY', 'LLM_MODEL'] },
]

/**
 * Groups that only make sense complete: setting one of them makes the rest
 * required (a VAPID public key without its private key sends nothing).
 */
const REQUIRED_TOGETHER: string[][] = [['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']]

/**
 * Problems with variables a chosen driver needs, one line per variable.
 * Names only: a value (possibly a secret) is never part of the message.
 */
export function dependentVariableProblems(values: Record<string, unknown>): string[] {
  const isBlank = (value: unknown) => {
    const raw =
      typeof value === 'object' && value !== null && 'release' in value
        ? (value as { release(): unknown }).release()
        : value
    return raw === undefined || raw === null || String(raw).trim() === ''
  }
  const byDriver = REQUIRED_BY_DRIVER.flatMap(({ when: [driver, choice], require }) =>
    values[driver] === choice
      ? require
          .filter((name) => isBlank(values[name]))
          .map((name) => `- ${name} is required when ${driver}=${choice}`)
      : []
  )
  const together = REQUIRED_TOGETHER.flatMap((group) => {
    const set = group.filter((name) => !isBlank(values[name]))
    if (set.length === 0 || set.length === group.length) return []
    return group
      .filter((name) => isBlank(values[name]))
      .map((name) => `- ${name} is required when ${set.join(', ')} is set`)
  })
  return [...byDriver, ...together]
}

/**
 * Validates exactly the given raw values against the schema (the same rules
 * `Env.create` applies at boot) and throws one error naming every missing or
 * invalid variable. Unlike `Env.rules().validate()`, it never falls back to
 * `process.env`, so it can check an isolated set of values.
 */
export function validateEnv(values: Record<string, string | undefined>): {
  [K in keyof EnvSchema]: ReturnType<EnvSchema[K]>
} {
  const problems: string[] = []
  const validated: Record<string, unknown> = {}
  for (const [name, rule] of Object.entries(envSchema)) {
    try {
      validated[name] = (rule as (key: string, value?: string) => unknown)(name, values[name])
    } catch (error) {
      problems.push(`- ${(error as Error).message}`)
    }
  }
  if (problems.length === 0) {
    problems.push(...dependentVariableProblems(validated))
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment variables:\n${problems.join('\n')}`)
  }
  return validated as { [K in keyof EnvSchema]: ReturnType<EnvSchema[K]> }
}
