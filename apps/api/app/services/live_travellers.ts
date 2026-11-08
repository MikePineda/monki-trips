import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * The ids of a trip's live travellers in display order (`position`, then
 * `created_at`): the order balances settle ties in and splits list
 * participants in, the same on every device.
 */
export async function liveTravellerIds(
  client: QueryClientContract | TransactionClientContract,
  tripId: string
): Promise<string[]> {
  const rows = (await client
    .from('travellers')
    .where('trip_id', tripId)
    .whereNull('deleted_at')
    .orderBy('position')
    .orderBy('created_at')
    .select('id')) as { id: string }[]
  return rows.map((row) => row.id)
}
