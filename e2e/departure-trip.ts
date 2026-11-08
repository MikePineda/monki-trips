import { randomUUID } from 'node:crypto'
import type { E2eAccount } from './accounts.ts'
import { ApiSession } from './api-session.ts'

export interface DepartureTrip {
  tripId: string
  flightId: string
}

/** Hours from now the seeded flight departs: its leave time lands inside the 36 h reminder window. */
const DEPARTS_IN_HOURS = 12
const DAY_MS = 86_400_000

/** `YYYY-MM-DDTHH:MM` of an instant read in UTC (the flight departs in the UTC zone). */
function utcLocal(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16)
}

/**
 * A synthetic trip running today with a flight that departs in twelve
 * hours, written through the API like the app writes it, so the reminder
 * planner has a "time to leave" in the next 36 hours. Replaces every trip
 * the account had. Invented names only.
 */
export async function seedDepartureTrip(account: E2eAccount): Promise<DepartureTrip> {
  const api = await ApiSession.signIn(account)
  try {
    await api.deleteAllTrips()
    const now = Date.now()
    const tripId = await api.createTrip({
      name: 'Island hop',
      startsOn: new Date(now - DAY_MS).toISOString().slice(0, 10),
      endsOn: new Date(now + 3 * DAY_MS).toISOString().slice(0, 10),
      baseCurrency: 'EUR',
    })
    const flightId = randomUUID()
    await api.push(tripId, [
      {
        entity: 'event',
        id: flightId,
        changes: {
          kind: 'flight',
          title: 'Flight to Port Vellmar',
          status: 'booked',
          startsLocal: utcLocal(now + DEPARTS_IN_HOURS * 3_600_000),
          startTz: 'UTC',
        },
      },
    ])
    return { tripId, flightId }
  } finally {
    await api.dispose()
  }
}
