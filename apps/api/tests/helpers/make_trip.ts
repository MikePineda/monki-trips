import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import type { TripMemberRole } from '@monkitrips/shared'
import type Trip from '#models/trip'
import TripMember from '#models/trip_member'
import Traveller from '#models/traveller'
import TripInvitation from '#models/trip_invitation'
import type User from '#models/user'
import { TripCreation, type NewTrip } from '#services/trip_creation'
import { generateSecureToken, hashToken } from '#domain/secure_token'

/** A trip owned by `owner` (owner membership and traveller included), through the real service. */
export async function makeTrip(owner: User, overrides: Partial<NewTrip> = {}): Promise<Trip> {
  const creation = await app.container.make(TripCreation)
  return creation.create(owner, {
    name: 'Demo Loop',
    baseCurrency: 'AUD',
    startsOn: '2027-01-20',
    endsOn: '2027-02-06',
    homeTz: 'Australia/Sydney',
    ...overrides,
  })
}

/** Adds `user` to `trip` directly (membership plus traveller), bypassing invitations. */
export async function addMember(
  trip: Trip,
  user: User,
  role: TripMemberRole = 'editor'
): Promise<TripMember> {
  const member = await TripMember.create({ tripId: trip.id, userId: user.id, role })
  await Traveller.create({ tripId: trip.id, userId: user.id, displayName: user.displayName })
  return member
}

/** An invitation row with its plaintext token (what the mail would carry). */
export async function makeInvitation(
  trip: Trip,
  inviter: User,
  overrides: { email?: string | null; expiresAt?: DateTime; revokedAt?: DateTime } = {}
): Promise<{ invitation: TripInvitation; token: string }> {
  const token = generateSecureToken()
  const invitation = await TripInvitation.create({
    tripId: trip.id,
    email: overrides.email ?? null,
    tokenHash: hashToken(token),
    role: 'editor',
    invitedBy: inviter.id,
    expiresAt: overrides.expiresAt ?? DateTime.now().plus({ days: 7 }),
    revokedAt: overrides.revokedAt ?? null,
  })
  return { invitation, token }
}
