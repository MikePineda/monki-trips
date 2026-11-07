import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'

/**
 * The public URL of the app (links in mails, absolute URLs). Comes from env:
 * no domain ever lives in source code.
 */
export const appUrl = env.get('APP_URL')

/**
 * The configuration settings used by the HTTP server
 */
export const http = defineConfig({
  /**
   * A unique id per request, to correlate log lines.
   */
  generateRequestId: true,

  /**
   * No `_method` spoofing: the SPA speaks real HTTP verbs.
   */
  allowMethodSpoofing: false,

  useAsyncLocalStorage: false,

  /**
   * X-Forwarded-* is trusted from loopback and private networks only (the
   * reverse proxy in front of the container). Anything public is ignored.
   */
  trustProxy: (address) =>
    address === '127.0.0.1' ||
    address === '::1' ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:)/i.test(address),

  router: {
    matcher: 'tree',
  },

  redirect: {
    forwardQueryString: true,
  },

  /**
   * Cookies of the HTTP layer. The session cookie lives in config/session.ts.
   */
  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
})
