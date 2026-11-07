/*
|--------------------------------------------------------------------------
| HTTP throttles
|--------------------------------------------------------------------------
|
| Counters live in Postgres (config/limiter.ts). Keys combine the client IP
| (`clientIp`: the socket, or the CDN's header only when `TRUSTED_PROXY`
| names that CDN) with the address under attack, so one person guessing
| cannot lock a shared office out. Login adds a per-address cap that ignores
| the IP, so a botnet cannot spread one address's guesses across IPs.
|
*/

import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { normalizeEmail } from '#domain/normalize_email'
import { resolveClientIp } from '#domain/client_address'

/** The client address: the CDN's header only behind a trusted CDN, else the socket. */
export function clientIp(ctx: HttpContext): string {
  return resolveClientIp({
    trustedProxy: env.get('TRUSTED_PROXY') ?? 'none',
    socketIp: ctx.request.ip(),
    cfConnectingIp: ctx.request.header('cf-connecting-ip'),
  })
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
 * Login counts failures only (`penalize`) on two keys at once: five wrong
 * passwords for an address from one IP, or ten for an address from any
 * mix of IPs, block it for 15 minutes. A success clears both counts.
 */
export function loginAttempts(ctx: HttpContext) {
  const email = emailOf(ctx)
  return limiter.multi([
    {
      key: `login:${clientIp(ctx)}:${email}`,
      requests: 5,
      duration: '15 mins',
      blockDuration: '15 mins',
    },
    { key: `login-email:${email}`, requests: 10, duration: '15 mins', blockDuration: '15 mins' },
  ])
}
