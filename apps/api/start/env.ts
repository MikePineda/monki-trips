/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Loads the .env files of the app root (process.env wins) and validates them
| against start/env_schema.ts at boot, including the variables a chosen
| driver makes required.
|
*/

import { Env } from '@adonisjs/core/env'
import { dependentVariableProblems, envSchema } from '#start/env_schema'

const env = await Env.create(new URL('../', import.meta.url), envSchema)

// Variables a chosen driver needs (S3 credentials with DRIVE_DISK=s3...).
const problems = dependentVariableProblems(
  Object.fromEntries(Object.keys(envSchema).map((name) => [name, env.get(name)]))
)
if (problems.length > 0) {
  throw new Error(`Invalid environment variables:\n${problems.join('\n')}`)
}

export default env
