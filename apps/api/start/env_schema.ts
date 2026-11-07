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

  // LLM (Anthropic Messages compatible)
  LLM_PROVIDER: Env.schema.enum.optional(['fake', 'anthropic'] as const),
  LLM_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  LLM_API_KEY: Env.schema.secret.optional(),
  LLM_MODEL: Env.schema.string.optional(),

  // Other external providers
  FX_PROVIDER: Env.schema.enum.optional(['fake', 'frankfurter'] as const),
  WEATHER_PROVIDER: Env.schema.enum.optional(['fake', 'open-meteo', 'off'] as const),
  FLIGHT_STATUS_PROVIDER: Env.schema.enum.optional(['fake', 'off'] as const),

  // Mail
  MAIL_DRIVER: Env.schema.enum.optional(['log', 'resend'] as const),
  MAIL_FROM: Env.schema.string.optional(),
  RESEND_API_KEY: Env.schema.secret.optional(),

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
  if (problems.length > 0) {
    throw new Error(`Invalid environment variables:\n${problems.join('\n')}`)
  }
  return validated as { [K in keyof EnvSchema]: ReturnType<EnvSchema[K]> }
}
