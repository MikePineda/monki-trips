import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/session'

/**
 * Sessions live in an encrypted cookie (stateless container: nothing on
 * disk, nothing in a shared store). Tests may use `memory`.
 */
const sessionConfig = defineConfig({
  enabled: true,
  cookieName: 'monkitrips_session',
  clearWithBrowser: false,
  age: '60d',
  cookie: {
    path: '/',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
  store: env.get('SESSION_DRIVER'),
  stores: {
    cookie: stores.cookie(),
  },
})

export default sessionConfig
