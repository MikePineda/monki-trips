import pg from 'pg'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

/**
 * `timestamp without time zone` (the `*_local` wall clocks of events and
 * segments) comes back as the text Postgres stores, `YYYY-MM-DD HH:mm:ss`.
 * pg's default builds a JS Date in the process zone, so the value would
 * depend on `TZ`, and a wall time inside that zone's DST gap would shift.
 */
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value: string) => value)

const dbConfig = defineConfig({
  connection: 'postgres',

  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD').release(),
        database: env.get('DB_DATABASE'),
      },
      pool: {
        min: 0,
        max: env.get('DB_POOL_MAX', 10),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      // Lucid regenerates database/schema.ts after migrations in development.
      // Off until the first model exists (WP 0.5): with no tables it writes
      // a file whose only import is unused and typecheck fails.
      schemaGeneration: {
        enabled: false,
      },
      debug: app.inDev && env.get('LOG_LEVEL') === 'debug',
    },
  },
})

export default dbConfig
