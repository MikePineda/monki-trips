import type { TripMemberRole } from '@monkitrips/shared'

/**
 * Trip fields only the owner may change through `POST /sync/push`, as the
 * contract (docs/CONTRACTS.md, Sync) and the API's applier define them:
 * the base currency. The budget total and the category budgets are content
 * any editor may change.
 */
export const OWNER_ONLY_TRIP_FIELDS: readonly string[] = ['baseCurrency']

/** Whether a person with `role` may change a trip field; an editor gets a disabled field, never a refusal. */
export function canEditTripField(
  role: TripMemberRole,
  field: string,
  ownerOnly: readonly string[] = OWNER_ONLY_TRIP_FIELDS
): boolean {
  return role === 'owner' || !ownerOnly.includes(field)
}
