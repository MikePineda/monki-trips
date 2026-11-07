import type { TripDocumentRow } from '@monkitrips/shared'
import type { DocRecord } from './records'

/** The device's row for a document the API returned (the tombstone left out). Pure. */
export function toDocumentRecord(row: TripDocumentRow): DocRecord {
  const { deletedAt, ...record } = row
  void deletedAt
  return { ...record, tags: record.tags ?? [] }
}
