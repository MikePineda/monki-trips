import { inject } from '@adonisjs/core'
import type { TripContentSnapshot } from '@monkitrips/shared'
import type Trip from '#models/trip'
import Traveller from '#models/traveller'
import { TripContent } from '#services/trip_content'
import { TripMembership } from '#services/trip_membership'
import { toTripWire } from '#transformers/trip_wire'
import { toTripMemberWire } from '#transformers/trip_member_wire'
import { toTravellerWire } from '#transformers/traveller_wire'

/**
 * The full state of a trip as the client caches it: trip, members,
 * travellers and every live content row. Export and the AI context are
 * built from this.
 */
@inject()
export class TripSnapshot {
  constructor(
    private readonly membership: TripMembership,
    private readonly content: TripContent
  ) {}

  async build(trip: Trip): Promise<TripContentSnapshot> {
    const [members, travellers, content] = await Promise.all([
      this.membership.membersOf(trip.id),
      Traveller.query().where('trip_id', trip.id).whereNull('deleted_at').orderBy('position'),
      this.content.load(trip.id),
    ])
    return {
      trip: toTripWire(trip),
      members: members.map(toTripMemberWire),
      travellers: travellers.map(toTravellerWire),
      ...content,
    }
  }
}
