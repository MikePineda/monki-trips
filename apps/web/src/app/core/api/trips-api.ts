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

export const TRIPS_API = new InjectionToken<TripsApi>('TRIPS_API', {
  providedIn: 'root',
  factory: () => new RealTripsApi(inject(API)),
})
