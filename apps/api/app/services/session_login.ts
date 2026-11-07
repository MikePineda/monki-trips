import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type User from '#models/user'

/** Session key holding the `users.session_version` the session was opened with. */
export const SESSION_VERSION_KEY = 'auth_session_version'

/**
 * Opens the session for a person: the guard stores the id, and the session
 * also remembers the current `sessionVersion`, which AuthMiddleware compares
 * on every request. Bumping the version on the user ends every other session.
 */
export async function loginUser(ctx: HttpContext, user: User, now: Date): Promise<void> {
  await ctx.auth.use('web').login(user)
  stampSessionVersion(ctx, user)
  user.lastLoginAt = DateTime.fromJSDate(now)
  await user.save()
}

/** Keeps the current session alive after the person's own version bump (change password, sign out elsewhere). */
export function stampSessionVersion(ctx: HttpContext, user: User): void {
  ctx.session.put(SESSION_VERSION_KEY, user.sessionVersion)
}
