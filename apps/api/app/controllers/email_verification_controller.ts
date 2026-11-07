import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, UserProfile } from '@monkitrips/shared'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { AuthMails } from '#services/auth_mails'
import { UserTokens } from '#services/user_tokens'
import { ApiException } from '#exceptions/api_exception'
import { toUserProfile } from '#transformers/user_profile'
import { verifyCodeValidator, verifyEmailValidator } from '#validators/auth'

/**
 * Proving an address: the link in the mail (public, works on any device) or
 * the 6-digit code typed into the signed-in app. Both come from one token
 * row that lives 15 minutes and allows five wrong codes.
 */
@inject()
export default class EmailVerificationController {
  constructor(
    private readonly clock: Clock,
    private readonly tokens: UserTokens,
    private readonly mails: AuthMails
  ) {}

  async verify(ctx: HttpContext) {
    const { token } = await ctx.request.validateUsing(verifyEmailValidator)
    const user = await this.tokens.consumeByToken(token, 'verify_email')
    await this.markVerified(user)
    return ctx.response.noContent()
  }

  async verifyCode(ctx: HttpContext): Promise<ApiEnvelope<UserProfile>> {
    const user = ctx.auth.use('web').getUserOrFail()
    if (user.emailVerifiedAt) throw new ApiException('E_EMAIL_ALREADY_VERIFIED')
    const { code } = await ctx.request.validateUsing(verifyCodeValidator)
    await this.tokens.consumeByCode(user, code)
    await this.markVerified(user)
    return { data: toUserProfile(user) }
  }

  /** A new mail with a new link and code; the previous ones stop working. */
  async resend(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    if (user.emailVerifiedAt) throw new ApiException('E_EMAIL_ALREADY_VERIFIED')
    const { token, code } = await this.tokens.issue(user, 'verify_email')
    await this.mails.sendVerification(user, token, code!)
    return ctx.response.accepted({ data: { accepted: true } })
  }

  private async markVerified(user: User) {
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = DateTime.fromJSDate(this.clock.now())
      await user.save()
    }
  }
}
