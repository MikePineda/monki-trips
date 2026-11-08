import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * The live traveller of the trip's owner: who paid an expense that names
 * nobody, when a trip switches to split and when balances fall back on a
 * default payer. Null when the owner has no live traveller.
 */
export async function ownerTravellerId(
  client: QueryClientContract | TransactionClientContract,
  tripId: string
): Promise<string | null> {
  const row = (await client
    .from('travellers')
    .join('trip_members', (join) => {
      join
        .on('trip_members.user_id', 'travellers.user_id')
        .andOn('trip_members.trip_id', 'travellers.trip_id')
    })
    .where('travellers.trip_id', tripId)
    .whereNull('travellers.deleted_at')
    .whereNull('trip_members.deleted_at')
    .where('trip_members.role', 'owner')
    .select('travellers.id')
    .first()) as { id: string } | null
  return row?.id ?? null
}
