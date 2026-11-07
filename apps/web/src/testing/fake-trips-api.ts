import type {
  CreateTripInput,
  IssuedTripInvitation,
  Trip,
  TripInvitation,
  TripListItem,
  TripMember,
  TripSnapshot,
} from '@monkitrips/shared'
import type { InviteByEmailInput, TripsApi } from '../app/core/api/trips-api'
import { FakeApi } from './fake-api'

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

/** A synthetic invitation row, pending unless said otherwise. */
export function fakeInvitation(overrides: Partial<TripInvitation> = {}): TripInvitation {
  return {
    id: 'invitation-1',
    tripId: 'trip-1',
    email: null,
    role: 'editor',
    invitedBy: 'local-traveller',
    expiresAt: '2026-11-14T00:00:00.000Z',
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
    state: 'pending',
    createdAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * In-memory stand-in: the trips in `trips` are the person's, everything
 * else is foreign. Members, travellers and invitations live per trip; the
 * mutating calls update them the way the server would.
 */
export class FakeTripsApi extends FakeApi implements TripsApi {
  trips: TripListItem[] = []
  membersByTrip = new Map<string, TripMember[]>()
  travellersByTrip = new Map<string, TripSnapshot['travellers']>()
  invitationsByTrip = new Map<string, TripInvitation[]>()
  nextInvitationToken = 'fake-invitation-token-0123456789'
  private issued = 0

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
      return {
        trip,
        members: this.membersByTrip.get(tripId) ?? [],
        travellers: this.travellersByTrip.get(tripId) ?? [],
      }
    })
  }

  members(tripId: string): Promise<TripMember[]> {
    return this.run(`members:${tripId}`, () => this.membersByTrip.get(tripId) ?? [])
  }

  removeMember(tripId: string, memberId: string): Promise<void> {
    return this.run(`removeMember:${tripId}:${memberId}`, () => {
      const members = this.membersByTrip.get(tripId) ?? []
      this.membersByTrip.set(
        tripId,
        members.filter((member) => member.id !== memberId)
      )
    })
  }

  transferOwnership(tripId: string, userId: string): Promise<TripMember[]> {
    return this.run(`transferOwnership:${tripId}:${userId}`, () => {
      const members = (this.membersByTrip.get(tripId) ?? []).map((member) => ({
        ...member,
        role:
          member.userId === userId
            ? ('owner' as const)
            : member.role === 'owner'
              ? ('editor' as const)
              : member.role,
      }))
      const sorted = [...members].sort((a, b) =>
        a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1
      )
      this.membersByTrip.set(tripId, sorted)
      return sorted
    })
  }

  invitations(tripId: string): Promise<TripInvitation[]> {
    return this.run(`invitations:${tripId}`, () => this.invitationsByTrip.get(tripId) ?? [])
  }

  inviteByLink(tripId: string): Promise<IssuedTripInvitation> {
    return this.run(`inviteByLink:${tripId}`, () => {
      const invitation = this.issue(tripId, null)
      return {
        delivery: 'link',
        token: this.nextInvitationToken,
        url: `http://localhost/invite/${this.nextInvitationToken}`,
        invitation,
      }
    })
  }

  inviteByEmail(tripId: string, input: InviteByEmailInput): Promise<IssuedTripInvitation> {
    return this.run(`inviteByEmail:${tripId}:${input.email}`, () => ({
      delivery: 'email',
      invitation: this.issue(tripId, input.email),
    }))
  }

  revokeInvitation(tripId: string, invitationId: string): Promise<void> {
    return this.run(`revokeInvitation:${tripId}:${invitationId}`, () => {
      const rows = this.invitationsByTrip.get(tripId) ?? []
      this.invitationsByTrip.set(
        tripId,
        rows.map((row) =>
          row.id === invitationId
            ? { ...row, state: 'revoked', revokedAt: '2026-11-07T12:00:00.000Z' }
            : row
        )
      )
    })
  }

  private issue(tripId: string, email: string | null): TripInvitation {
    this.issued += 1
    const invitation = fakeInvitation({ id: `invitation-${this.issued}`, tripId, email })
    this.invitationsByTrip.set(tripId, [invitation, ...(this.invitationsByTrip.get(tripId) ?? [])])
    return invitation
  }
}
