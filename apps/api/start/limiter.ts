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
|| Routes that call the LLM are throttled per account (`throttleLlm`).
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

/**
 * The signed-in account (the auth middleware has run: paid routes sit
 * behind it), else the client address as a fallback.
 */
function accountKey(ctx: HttpContext): string {
  const user = ctx.auth.use('web').user
  return user ? `user:${user.id}` : `ip:${clientIp(ctx)}`
}

/** Paid model calls: 5 per minute per account (bursts). */
export const throttleLlmPerMinute = limiter.define('llm_minute', (ctx) =>
  limiter.allowRequests(5).every('1 min').usingKey(accountKey(ctx))
)

/** Paid model calls: 30 per day per account (sustained use). */
export const throttleLlmPerDay = limiter.define('llm_day', (ctx) =>
  limiter.allowRequests(30).every('1 day').usingKey(accountKey(ctx))
)

/**
 * Every route that can call the LLM uses both: the monthly token cap bounds
 * cost, these bound how fast one account can spend it (and the provider's
 * rate limit, which every account shares).
 */
export const throttleLlm = [throttleLlmPerMinute, throttleLlmPerDay]

/**
 * Weather lookups: 120 per hour per account. Today asks once per visit and
 * "Download everything" asks once per trip day ahead (at most 16); the
 * shared 30-minute cache keeps the provider's free tier far away.
 */
export const throttleWeather = limiter.define('weather', (ctx) =>
  limiter.allowRequests(120).every('1 hour').usingKey(accountKey(ctx))
)
