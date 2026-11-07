import type { EmergencyInfo } from '@monkitrips/shared'
import type { EmergencyRecord } from './records'

/** The device's row for a trip's emergency information. Pure. */
export function toEmergencyRecord(row: EmergencyInfo): EmergencyRecord {
  return {
    id: row.tripId,
    tripId: row.tripId,
    content: row.content,
    schemaVersion: row.schemaVersion,
    updatedAt: row.updatedAt,
  }
}
