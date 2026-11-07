import type { SegmentSeat } from '@monkitrips/shared'
import type { SeatRecord } from './records'

/** The device's row for a seat the API returned (the tombstone left out). Pure. */
export function toSeatRecord(row: SegmentSeat): SeatRecord {
  const { deletedAt, ...record } = row
  void deletedAt
  return record
}
