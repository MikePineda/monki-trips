import { inject, InjectionToken } from '@angular/core'
import type {
  CreateTripInput,
  IssuedTripInvitation,
  Trip,
  TripListItem,
  TripMember,
  TripSnapshot,
} from '@monkitrips/shared'
import { API } from './api'
import { FakeApi } from './fake-api'
import { RealTripsApi } from './real-trips-api'

/**
 * Trips of the signed-in person. Failures are ApiFailures; `snapshot()`
 * answers `null` for a trip the person is not a member of (the API says
 * 404, never 403: the trip is the tenant boundary).
 */
export interface TripsApi {
  list(): Promise<TripListItem[]>
  create(input: CreateTripInput): Promise<Trip>
  snapshot(tripId: string): Promise<TripSnapshot | null>
  members(tripId: string): Promise<TripMember[]>
  /** An invitation by link (owner only): the token and URL come back exactly once. */
  inviteByLink(tripId: string): Promise<IssuedTripInvitation>
}

/** A synthetic trip the fake API hands out. */
export function fakeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    name: 'Sample trip',
    baseCurrency: 'EUR',
    budgetMode: 'shared',
    budgetTotalMinor: null,
    startsOn: '2027-01-20',
    endsOn: '2027-02-06',
    homeTz: 'UTC',
    createdBy: 'local-traveller',
    deletedAt: null,
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

/** In-memory stand-in: the trips in `trips` are the person's, everything else is foreign. */
export class FakeTripsApi extends FakeApi implements TripsApi {
  trips: TripListItem[] = []
  membersByTrip = new Map<string, TripMember[]>()
  nextInvitationToken = 'fake-invitation-token-0123456789'

  list(): Promise<TripListItem[]> {
    return this.run('list', () => this.trips)
  }

  create(input: CreateTripInput): Promise<Trip> {
    return this.run(`create:${input.name}`, () => {
      const trip = fakeTrip({
        id: input.id ?? `trip-${this.trips.length + 1}`,
        name: input.name,
        baseCurrency: input.baseCurrency,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        budgetMode: input.budgetMode ?? 'shared',
        budgetTotalMinor: input.budgetTotalMinor ?? null,
      })
      this.trips = [...this.trips, { ...trip, role: 'owner', memberCount: 1 }]
      return trip
    })
  }

  snapshot(tripId: string): Promise<TripSnapshot | null> {
    return this.run(`snapshot:${tripId}`, () => {
      const trip = this.trips.find((item) => item.id === tripId)
      if (!trip) {
        return null
      }
      return { trip, members: this.membersByTrip.get(tripId) ?? [], travellers: [] }
    })
  }

  members(tripId: string): Promise<TripMember[]> {
    return this.run(`members:${tripId}`, () => this.membersByTrip.get(tripId) ?? [])
  }

  inviteByLink(tripId: string): Promise<IssuedTripInvitation> {
    return this.run(`inviteByLink:${tripId}`, () => ({
      delivery: 'link',
      token: this.nextInvitationToken,
      url: `http://localhost/invite/${this.nextInvitationToken}`,
      invitation: {
        id: 'invitation-1',
        tripId,
        email: null,
        role: 'editor',
        invitedBy: 'local-traveller',
        expiresAt: '2026-11-14T00:00:00.000Z',
        acceptedAt: null,
        acceptedBy: null,
        revokedAt: null,
        state: 'pending',
        createdAt: '2026-11-07T00:00:00.000Z',
      },
    }))
  }
}

export const TRIPS_API = new InjectionToken<TripsApi>('TRIPS_API', {
  providedIn: 'root',
  factory: () => new RealTripsApi(inject(API)),
})
