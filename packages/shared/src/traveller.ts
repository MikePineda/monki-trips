/**
 * Someone who travels: every member gets one, and a trip can hold people
 * without an account (children, a friend without the app) for seats and
 * expense shares.
 */
export interface Traveller {
  id: string
  tripId: string
  displayName: string
  /** Account behind this traveller, or null for a person without one. */
  userId: string | null
  position: number
  /** ISO instant while the traveller is soft-deleted (sync tombstone), absent on the REST routes. */
  deletedAt?: string | null
  updatedAt?: string
}
