import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  /**
   * CSP is off until the nonce-based policy lands (report-only first).
   */
  csp: {
    enabled: false,
    directives: {},
    reportOnly: false,
  },

  /**
   * CSRF on every state-changing request. The SPA reads the XSRF-TOKEN
   * cookie and sends it back as the X-XSRF-TOKEN header.
   */
  csrf: {
    enabled: true,
    exceptRoutes: [],
    enableXsrfCookie: true,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  xFrame: {
    enabled: true,
    action: 'DENY',
  },

  hsts: {
    enabled: true,
    maxAge: '180 days',
  },

  contentTypeSniffing: {
    enabled: true,
  },
})

export default shieldConfig
