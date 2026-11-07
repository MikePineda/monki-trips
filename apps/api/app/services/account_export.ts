import { inject } from '@adonisjs/core'
import type { AccountExport as AccountExportWire } from '@monkitrips/shared'
import { TRIP_JSON_SCHEMA_VERSION } from '@monkitrips/shared'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { TripExporter } from '#services/trip_exporter'
import { TripMembership } from '#services/trip_membership'
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
    private readonly exporter: TripExporter
  ) {}

  async build(user: User): Promise<AccountExportWire> {
    const exportedAt = this.clock.now()
    const memberships = await this.membership.tripsOf(user)
    const trips = []
    for (const membership of memberships) {
      trips.push(await this.exporter.build(membership.trip, exportedAt))
    }
    return {
      schemaVersion: TRIP_JSON_SCHEMA_VERSION,
      exportedAt: exportedAt.toISOString(),
      profile: toUserProfile(user),
      trips,
    }
  }
}
