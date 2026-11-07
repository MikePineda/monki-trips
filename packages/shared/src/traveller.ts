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
}
