import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { ApiException } from '#exceptions/api_exception'
import { SESSION_VERSION_KEY } from '#services/session_login'

/**
 * Requires a signed-in person. Beyond the guard's own check, the session
 * must carry the account's current `sessionVersion` (otherwise it was
 * revoked by "sign out everywhere", a password reset or an operator) and the
 * account must not be disabled. Failures end the session and answer JSON.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const guard = ctx.auth.use('web')
    if (!(await guard.check())) {
      throw new ApiException('E_UNAUTHORIZED')
    }
    const user = guard.getUserOrFail()
    if (ctx.session.get(SESSION_VERSION_KEY) !== user.sessionVersion) {
      await guard.logout()
      throw new ApiException('E_UNAUTHORIZED')
    }
    if (user.status === 'disabled') {
      await guard.logout()
      throw new ApiException('E_ACCOUNT_DISABLED')
    }
    return next()
  }
}
