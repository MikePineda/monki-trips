import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { AuthMails } from '#services/auth_mails'
import { UserTokens } from '#services/user_tokens'
import { forgotPasswordValidator, resetPasswordValidator } from '#validators/auth'

/**
 * Password reset by mail. `forgot` always answers 202 so it reveals nothing
 * about which addresses exist; `reset` consumes the single-use, 60-minute
 * token and signs the person out everywhere.
 */
@inject()
export default class PasswordResetController {
  constructor(
    private readonly tokens: UserTokens,
    private readonly mails: AuthMails
  ) {}

  async forgot(ctx: HttpContext) {
    const { email } = await ctx.request.validateUsing(forgotPasswordValidator)
    const user = await User.findBy('email', email)
    if (user && user.status === 'active') {
      const { token } = await this.tokens.issue(user, 'reset_password')
      await this.mails.sendPasswordReset(user, token)
    }
    return ctx.response.accepted({ data: { accepted: true } })
  }

  async reset(ctx: HttpContext) {
    const { token, password } = await ctx.request.validateUsing(resetPasswordValidator)
    const user = await this.tokens.consumeByToken(token, 'reset_password')
    user.password = password
    await user.revokeAllSessions()
    return ctx.response.noContent()
  }
}
