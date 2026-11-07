import { inject, InjectionToken } from '@angular/core'
import type {
  CreateTripInput,
  InvitableRole,
  IssuedTripInvitation,
  Trip,
  TripInvitation,
  TripListItem,
  TripMember,
  TripSnapshot,
} from '@monkitrips/shared'
import { API } from './api'
import { RealTripsApi } from './real-trips-api'

export interface InviteByEmailInput {
  email: string
  role?: InvitableRole
}

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
  /** Removes a member (owner), or the caller's own membership (editor leaving). */
  removeMember(tripId: string, memberId: string): Promise<void>
  /** Makes `userId` the owner and the caller an editor (owner only); the members after the swap. */
  transferOwnership(tripId: string, userId: string): Promise<TripMember[]>
  /** Every invitation of the trip with its state (owner only); never a token. */
  invitations(tripId: string): Promise<TripInvitation[]>
  /** An invitation by link (owner only): the token and URL come back exactly once. */
  inviteByLink(tripId: string): Promise<IssuedTripInvitation>
  /** An invitation mailed to an address (owner only): the answer never carries the token. */
  inviteByEmail(tripId: string, input: InviteByEmailInput): Promise<IssuedTripInvitation>
  /** Revokes a pending invitation (owner only); its link answers 410 from then on. */
  revokeInvitation(tripId: string, invitationId: string): Promise<void>
}

export const TRIPS_API = new InjectionToken<TripsApi>('TRIPS_API', {
  providedIn: 'root',
  factory: () => new RealTripsApi(inject(API)),
})
