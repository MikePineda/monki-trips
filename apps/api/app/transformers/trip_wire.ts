import type { Trip as TripWire, TripListItem, TripMemberRole } from '@monkitrips/shared'
import type Trip from '#models/trip'

/** A trip on the wire: dates as `YYYY-MM-DD`, instants as ISO strings. */
export function toTripWire(trip: Trip): TripWire {
  return {
    id: trip.id,
    name: trip.name,
    baseCurrency: trip.baseCurrency,
    budgetMode: trip.budgetMode,
    budgetTotalMinor: trip.budgetTotalMinor,
    startsOn: trip.startsOn.toISODate()!,
    endsOn: trip.endsOn.toISODate()!,
    homeTz: trip.homeTz,
    createdBy: trip.createdBy,
    deletedAt: trip.deletedAt?.toISO() ?? null,
    createdAt: trip.createdAt.toISO()!,
    updatedAt: trip.updatedAt.toISO()!,
  }
}

export function toTripListItem(
  trip: Trip,
  role: TripMemberRole,
  memberCount: number
): TripListItem {
  return { ...toTripWire(trip), role, memberCount }
}
