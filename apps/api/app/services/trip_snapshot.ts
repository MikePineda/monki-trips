import { inject } from '@adonisjs/core'
import type { TripSnapshot as TripSnapshotWire } from '@monkitrips/shared'
import type Trip from '#models/trip'
import Traveller from '#models/traveller'
import { TripMembership } from '#services/trip_membership'
import { toTripWire } from '#transformers/trip_wire'
import { toTripMemberWire } from '#transformers/trip_member_wire'
import { toTravellerWire } from '#transformers/traveller_wire'

/**
 * The full state of a trip as the client caches it: trip, members and
 * travellers today; every content entity joins with its phase. Export and
 * the AI context are built from this.
 */
@inject()
export class TripSnapshot {
  constructor(private readonly membership: TripMembership) {}

  async build(trip: Trip): Promise<TripSnapshotWire> {
    const [members, travellers] = await Promise.all([
      this.membership.membersOf(trip.id),
      Traveller.query().where('trip_id', trip.id).whereNull('deleted_at').orderBy('position'),
    ])
    return {
      trip: toTripWire(trip),
      members: members.map(toTripMemberWire),
      travellers: travellers.map(toTravellerWire),
    }
  }
}
