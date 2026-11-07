import { indexEntities } from '@adonisjs/core/generators'
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@tuyau/core/hooks'

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Experimental flags
  |--------------------------------------------------------------------------
  */
  experimental: {},

  /*
  |--------------------------------------------------------------------------
  | Commands
  |--------------------------------------------------------------------------
  |
  | Package commands. Application commands are scanned from "./commands".
  |
  */
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/session/commands'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Service providers
  |--------------------------------------------------------------------------
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/shield/shield_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/static/static_provider'),
    () => import('@adonisjs/i18n/i18n_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('@adonisjs/limiter/limiter_provider'),
    () => import('#providers/mail_provider'),
    () => import('#providers/push_provider'),
    () => import('#providers/deferred_tasks_provider'),
    () => import('#providers/scheduler_provider'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Preloads
  |--------------------------------------------------------------------------
  */
  preloads: [() => import('#start/routes'), () => import('#start/kernel')],

  /*
  |--------------------------------------------------------------------------
  | Tests
  |--------------------------------------------------------------------------
  |
  | `unit` never touches the database; `functional` gets a migrated test
  | database and a global transaction per test (tests/bootstrap.ts).
  |
  */
  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec.{ts,js}'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec.{ts,js}'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: false,
  },

  /*
  |--------------------------------------------------------------------------
  | Metafiles
  |--------------------------------------------------------------------------
  |
  | Copied to the build folder by `node ace build`.
  |
  */
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: false,
    },
    {
      pattern: 'resources/lang/**/*.{json,yaml,yml}',
      reloadServer: false,
    },
  ],

  hooks: {
    init: [
      // The client manifest references adonisrc.ts and the config files, so a
      // consumer of the registry (the web app) sees the same HttpContext
      // augmentations (auth, validation, i18n, limiter) the API compiles with.
      indexEntities({ manifest: { enabled: true } }),
      // The SPA fallback is not part of the typed contract.
      generateRegistry({
        routes: { except: ['spa.fallback'] },
      }),
    ],
  },
})
