import type { EventSegmentRow } from '@monkitrips/shared'
import type { SegmentRecord } from './records'

/** The device's row for one leg of a transport the API returned (the tombstone left out). Pure. */
export function toSegmentRecord(row: EventSegmentRow): SegmentRecord {
  const { deletedAt, ...record } = row
  void deletedAt
  return record
}
