import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type {
  AccountExport as AccountExportWire,
  ApiEnvelope,
  UserProfile,
} from '@monkitrips/shared'
import { Clock } from '#services/clock'
import { AccountExport } from '#services/account_export'
import { TripMembership } from '#services/trip_membership'
import { stampSessionVersion } from '#services/session_login'
import { ApiException } from '#exceptions/api_exception'
import { deletionDate, soleOwnedSharedTrips } from '#domain/account_deletion'
import { toUserProfile } from '#transformers/user_profile'
import {
  changePasswordValidator,
  deleteAccountValidator,
  updateProfileValidator,
} from '#validators/account'

/** The signed-in person's own account: profile, password, export, deletion. */
@inject()
export default class ProfileController {
  constructor(
    private readonly clock: Clock,
    private readonly memberships: TripMembership,
    private readonly accountExport: AccountExport
  ) {}

  async update(ctx: HttpContext): Promise<ApiEnvelope<UserProfile>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const body = await ctx.request.validateUsing(updateProfileValidator)
    user.merge(body)
    await user.save()
    return { data: toUserProfile(user) }
  }

  /** Re-asks the current password; other sessions end, this one continues. */
  async changePassword(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    const body = await ctx.request.validateUsing(changePasswordValidator)
    if (!(await user.verifyPassword(body.currentPassword))) {
      throw new ApiException('E_INVALID_PASSWORD')
    }
    user.password = body.password
    await user.revokeAllSessions()
    stampSessionVersion(ctx, user)
    return ctx.response.noContent()
  }

  async export(ctx: HttpContext): Promise<ApiEnvelope<AccountExportWire>> {
    const user = ctx.auth.use('web').getUserOrFail()
    ctx.response.header('Content-Disposition', 'attachment; filename="monki-trips-export.json"')
    return { data: await this.accountExport.build(user) }
  }

  /**
   * Schedules the hard delete 30 days out and signs the person out
   * everywhere. Refused (409 with `tripIds`) while they own a trip other
   * people still use: ownership must move first.
   */
  async destroy(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    const { password } = await ctx.request.validateUsing(deleteAccountValidator)
    if (!(await user.verifyPassword(password))) throw new ApiException('E_INVALID_PASSWORD')

    const memberships = await this.memberships.tripsOf(user)
    const counts = await this.memberships.memberCounts(memberships.map((m) => m.tripId))
    const blocking = soleOwnedSharedTrips(
      memberships.map((m) => ({
        tripId: m.tripId,
        role: m.role,
        otherMemberCount: (counts.get(m.tripId) ?? 1) - 1,
      }))
    )
    if (blocking.length > 0) {
      throw new ApiException('E_SOLE_OWNER_OF_SHARED_TRIPS', { tripIds: blocking })
    }

    user.deletionScheduledAt = DateTime.fromJSDate(deletionDate(this.clock.now()))
    await user.revokeAllSessions()
    await ctx.auth.use('web').logout()
    return ctx.response.noContent()
  }

  /** Cancels a scheduled deletion (the person signed in again during the grace period). */
  async restore(ctx: HttpContext): Promise<ApiEnvelope<UserProfile>> {
    const user = ctx.auth.use('web').getUserOrFail()
    if (!user.deletionScheduledAt) throw new ApiException('E_DELETION_NOT_SCHEDULED')
    user.deletionScheduledAt = null
    await user.save()
    return { data: toUserProfile(user) }
  }
}
