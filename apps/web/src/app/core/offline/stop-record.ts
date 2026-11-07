import type { TripStopRow } from '@monkitrips/shared'
import type { StopRecord } from './records'

/** The device's row for a stop the API returned (the tombstone left out). Pure. */
export function toStopRecord(row: TripStopRow): StopRecord {
  const { deletedAt, ...record } = row
  void deletedAt
  return record
}
