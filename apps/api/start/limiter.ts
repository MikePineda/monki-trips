/*
|--------------------------------------------------------------------------
| HTTP throttles
|--------------------------------------------------------------------------
|
| Counters live in Postgres (config/limiter.ts). Keys combine the client IP
| (behind the CDN: `clientIp`) with the address under attack, so one person
| guessing cannot lock a shared office out and a botnet cannot spread one
| address's attempts across IPs for free.
|
*/

import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import { normalizeEmail } from '#domain/normalize_email'

/** The client address: the CDN's header when present (trusted proxies only), else the socket. */
export function clientIp(ctx: HttpContext): string {
  return ctx.request.header('cf-connecting-ip') ?? ctx.request.ip()
}

function emailOf(ctx: HttpContext): string {
  const email = ctx.request.input('email')
  return typeof email === 'string' ? normalizeEmail(email) : '-'
}

/** Sign-ups: 10 per hour per IP. */
export const throttleSignup = limiter.define('signup', (ctx) =>
  limiter.allowRequests(10).every('1 hour').usingKey(clientIp(ctx))
)

/** Forgot-password mails: 5 per 15 minutes per IP and address. */
export const throttleForgot = limiter.define('forgot', (ctx) =>
  limiter
    .allowRequests(5)
    .every('15 mins')
    .usingKey(`${clientIp(ctx)}:${emailOf(ctx)}`)
)

/** Verification links, codes and resends: 10 per 15 minutes per IP. */
export const throttleVerify = limiter.define('verify', (ctx) =>
  limiter.allowRequests(10).every('15 mins').usingKey(clientIp(ctx))
)

/**
 * Login counts failures only (`penalize`): five wrong passwords for an
 * address from one IP block it for 15 minutes; a success clears the count.
 */
export function loginAttempts() {
  return limiter.use({ requests: 5, duration: '15 mins', blockDuration: '15 mins' })
}

export function loginKey(ctx: HttpContext): string {
  return `login:${clientIp(ctx)}:${emailOf(ctx)}`
}
