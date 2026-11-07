import TripMember from '#models/trip_member'
import type User from '#models/user'

/**
 * Queries over who belongs to which trip. Everything tenant-scoped starts
 * here: a trip the person is not a live member of simply does not exist for
 * them (404, never 403).
 */
export class TripMembership {
  /** The person's live membership in a trip, with the trip loaded, or null. */
  async find(user: User, tripId: string): Promise<TripMember | null> {
    return TripMember.query()
      .where('trip_id', tripId)
      .where('user_id', user.id)
      .whereNull('deleted_at')
      .preload('trip')
      .first()
  }

  /** Live members of a trip with their accounts, owner first then by join date. */
  async membersOf(tripId: string): Promise<TripMember[]> {
    return TripMember.query()
      .where('trip_id', tripId)
      .whereNull('deleted_at')
      .preload('user')
      .orderByRaw("case when role = 'owner' then 0 else 1 end")
      .orderBy('joined_at', 'asc')
  }

  /** The person's live memberships in live (not soft-deleted) trips, with the trip loaded, newest first. */
  async tripsOf(user: User): Promise<TripMember[]> {
    return TripMember.query()
      .where('user_id', user.id)
      .whereNull('deleted_at')
      .whereHas('trip', (trip) => trip.whereNull('deleted_at'))
      .preload('trip')
      .orderBy('joined_at', 'desc')
  }

  /** Live member counts per trip id. */
  async memberCounts(tripIds: string[]): Promise<Map<string, number>> {
    if (tripIds.length === 0) return new Map()
    const rows = await TripMember.query()
      .whereIn('trip_id', tripIds)
      .whereNull('deleted_at')
      .groupBy('trip_id')
      .select('trip_id')
      .count('* as count')
    return new Map(
      rows.map((row) => {
        const { count } = row.$extras as { count: string | number }
        return [row.tripId, Number(count)]
      })
    )
  }
}
