/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Loads the .env files of the app root (process.env wins) and validates them
| against start/env_schema.ts at boot.
|
*/

import { Env } from '@adonisjs/core/env'
import { envSchema } from '#start/env_schema'

export default await Env.create(new URL('../', import.meta.url), envSchema)
