import type { Locale } from './locales.ts'

/**
 * Public, unauthenticated configuration (`GET /api/v1/config`): what the
 * web app needs before anyone signs in. Also the request that hands out the
 * CSRF cookie.
 */
export interface AppConfig {
  /** Whether `POST /auth/signup` accepts people without an invitation. */
  registrationOpen: boolean
  locales: readonly Locale[]
  defaultLocale: Locale
  version: string
  /** Whether the server can send Web Push (every `VAPID_*` variable is set). */
  pushEnabled: boolean
  /** The VAPID public key browsers subscribe with (`applicationServerKey`); null while push is disabled. */
  vapidPublicKey: string | null
}
