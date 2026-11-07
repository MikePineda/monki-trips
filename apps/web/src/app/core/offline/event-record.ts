import type { TripEventRow } from '@monkitrips/shared'
import type { EventRecord } from './records'

/** The device's row for an itinerary event the API returned (the tombstone left out). Pure. */
export function toEventRecord(row: TripEventRow): EventRecord {
  const { deletedAt, ...record } = row
  void deletedAt
  return record
}
