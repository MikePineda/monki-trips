import type { ApiRequest } from '@japa/api-client'
import type User from '#models/user'
import { SESSION_VERSION_KEY } from '#services/session_login'

/**
 * Laravel's `actingAs`: signs the request in as `user` the way a real login
 * does (guard session key plus the session version AuthMiddleware checks)
 * and attaches a CSRF token so mutating verbs pass shield.
 */
export function actingAs<T extends ApiRequest>(request: T, user: User): T {
  return request
    .loginAs(user)
    .withSession({ [SESSION_VERSION_KEY]: user.sessionVersion })
    .withCsrfToken()
}
