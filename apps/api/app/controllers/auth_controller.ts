import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { errors as authErrors } from '@adonisjs/auth'
import type { ApiEnvelope, Locale, UserProfile } from '@monkitrips/shared'
import User from '#models/user'
import { Clock } from '#services/clock'
import { AuthMails } from '#services/auth_mails'
import { UserTokens } from '#services/user_tokens'
import { RegistrationPolicy } from '#services/registration_policy'
import { InvitationAcceptance } from '#services/invitation_acceptance'
import { loginUser, stampSessionVersion } from '#services/session_login'
import { loginAttempts } from '#start/limiter'
import { ApiException } from '#exceptions/api_exception'
import { signupGate } from '#domain/signup_gate'
import { toUserProfile } from '#transformers/user_profile'
import { loginValidator, signupValidator } from '#validators/auth'

/** Sign-up, sign-in and the session itself. */
@inject()
export default class AuthController {
  constructor(
    private readonly clock: Clock,
    private readonly registration: RegistrationPolicy,
    private readonly invitations: InvitationAcceptance,
    private readonly tokens: UserTokens,
    private readonly mails: AuthMails
  ) {}

  /**
   * Creates the account and signs it in. While registration is closed only
   * a pending invitation opens the door; an invitation sent to the same
   * address also verifies it. Otherwise a verification mail goes out.
   */
  async signup(ctx: HttpContext): Promise<ApiEnvelope<UserProfile>> {
    const body = await ctx.request.validateUsing(signupValidator)
    const invitation = body.invitationToken
      ? await this.invitations.findByToken(body.invitationToken)
      : null
    const decision = signupGate({
      registrationOpen: this.registration.isOpen(),
      email: body.email,
      invitation:
        invitation && !invitation.trip.deletedAt
          ? { state: this.invitations.stateOf(invitation), email: invitation.email }
          : null,
      unknownInvitation: !!body.invitationToken && !invitation,
    })
    if (!decision.allowed) throw new ApiException(decision.code)
    if (await User.findBy('email', body.email)) throw new ApiException('E_EMAIL_TAKEN')

    const now = this.clock.now()
    const user = await User.create({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      locale: body.locale ?? (ctx.i18n.locale as Locale),
      timezone: body.timezone ?? 'UTC',
      emailVerifiedAt: decision.emailVerifiedByInvitation ? DateTime.fromJSDate(now) : null,
    })
    if (invitation && decision.viaInvitation) {
      await this.invitations.accept(invitation, user)
    }
    await loginUser(ctx, user, now)
    if (!user.emailVerifiedAt) {
      const { token, code } = await this.tokens.issue(user, 'verify_email')
      await this.mails.sendVerification(user, token, code!)
    }
    ctx.response.status(201)
    return { data: toUserProfile(user) }
  }

  /**
   * Five wrong passwords for an address from one IP, or ten from anywhere,
   * block it for 15 minutes.
   */
  async login(ctx: HttpContext): Promise<ApiEnvelope<UserProfile>> {
    const body = await ctx.request.validateUsing(loginValidator)
    const [throttled, user] = await loginAttempts(ctx).penalize(async () => {
      try {
        return await User.verifyCredentials(body.email, body.password)
      } catch (error) {
        if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
          throw new ApiException('E_INVALID_CREDENTIALS')
        }
        throw error
      }
    })
    if (throttled) throw throttled
    if (user.status === 'disabled') throw new ApiException('E_ACCOUNT_DISABLED')

    await loginUser(ctx, user, this.clock.now())
    return { data: toUserProfile(user) }
  }

  async me(ctx: HttpContext): Promise<ApiEnvelope<UserProfile>> {
    return { data: toUserProfile(ctx.auth.use('web').getUserOrFail()) }
  }

  async logout(ctx: HttpContext) {
    await ctx.auth.use('web').logout()
    return ctx.response.noContent()
  }

  /** Ends every other session; this one continues. */
  async logoutAll(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    await user.revokeAllSessions()
    stampSessionVersion(ctx, user)
    return ctx.response.noContent()
  }
}
