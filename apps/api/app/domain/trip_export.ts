import {
  TRIP_JSON_SCHEMA_VERSION,
  type Traveller,
  type Trip,
  type TripJsonV1,
  type TripMember,
} from '@monkitrips/shared'

/**
 * Builds the portable trip document from a snapshot. Account ids never
 * leave: members keep role and display name only, travellers drop their
 * `userId`. `exportedAt` is a parameter so the output is reproducible.
 */
export function buildTripJsonV1(input: {
  trip: Trip
  members: TripMember[]
  travellers: Traveller[]
  exportedAt: Date
}): TripJsonV1 {
  const { id, name, baseCurrency, budgetMode, budgetTotalMinor, startsOn, endsOn, homeTz } =
    input.trip
  return {
    schemaVersion: TRIP_JSON_SCHEMA_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    trip: { id, name, baseCurrency, budgetMode, budgetTotalMinor, startsOn, endsOn, homeTz },
    members: input.members.map(({ role, displayName }) => ({ role, displayName })),
    travellers: input.travellers.map(({ id: travellerId, displayName, position }) => ({
      id: travellerId,
      displayName,
      position,
    })),
  }
}
