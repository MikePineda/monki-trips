import { inject } from '@adonisjs/core'
import type { AccountExport as AccountExportWire } from '@monkitrips/shared'
import { TRIP_JSON_SCHEMA_VERSION } from '@monkitrips/shared'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { TripMembership } from '#services/trip_membership'
import { TripSnapshot } from '#services/trip_snapshot'
import { buildTripJsonV1 } from '#domain/trip_export'
import { toUserProfile } from '#transformers/user_profile'

/**
 * Everything the person can take with them (`GET /me/export`): the profile
 * and one trip JSON v1 document per live trip they belong to.
 */
@inject()
export class AccountExport {
  constructor(
    private readonly clock: Clock,
    private readonly membership: TripMembership,
    private readonly snapshot: TripSnapshot
  ) {}

  async build(user: User): Promise<AccountExportWire> {
    const exportedAt = this.clock.now()
    const memberships = await this.membership.tripsOf(user)
    const trips = []
    for (const membership of memberships) {
      const { trip, members, travellers } = await this.snapshot.build(membership.trip)
      trips.push(buildTripJsonV1({ trip, members, travellers, exportedAt }))
    }
    return {
      schemaVersion: TRIP_JSON_SCHEMA_VERSION,
      exportedAt: exportedAt.toISOString(),
      profile: toUserProfile(user),
      trips,
    }
  }
}
