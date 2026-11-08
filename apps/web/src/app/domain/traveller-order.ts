/** The fields the trip's traveller order reads. */
export interface OrderedTraveller {
  id: string
  position: number
  /** When the server created the row; absent until a row made on this device syncs. */
  createdAt?: string
  updatedAt: string
}

/**
 * The order travellers are listed and balances settle ties in: `position`,
 * then creation, as the server sorts them (`position, created_at`), so a
 * device and the API pick the same settle-up list. A row not synced yet
 * counts from its last change; the id breaks any remaining tie. Pure.
 */
export function byTravellerOrder(a: OrderedTraveller, b: OrderedTraveller): number {
  return (
    a.position - b.position ||
    (a.createdAt ?? a.updatedAt).localeCompare(b.createdAt ?? b.updatedAt) ||
    a.id.localeCompare(b.id)
  )
}
