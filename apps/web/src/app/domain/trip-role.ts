import type { TripMemberRole } from '@monkitrips/shared'

/**
 * The signed-in person's role in a trip: the members table (synced) is
 * authoritative, the trip list's `role` is the fallback before the first
 * pull; with neither, the conservative answer is editor. Pure.
 */
export function tripRole(
  members: readonly { userId: string; role: TripMemberRole }[],
  userId: string | null | undefined,
  listedRole: TripMemberRole | undefined
): TripMemberRole {
  const member = userId ? members.find((row) => row.userId === userId) : undefined
  return member?.role ?? listedRole ?? 'editor'
}
