import type { EntitySpec } from '#services/sync/entity_spec'
import { stopChanges } from '#validators/sync/entities'

export const stopEntity: EntitySpec = {
  entity: 'stop',
  table: 'stops',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: stopChanges,
  requiredOnInsert: ['name'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'position', column: 'position', type: 'int', writable: true },
    { field: 'name', column: 'name', type: 'text', writable: true },
    { field: 'countryCode', column: 'country_code', type: 'text', writable: true },
    { field: 'lat', column: 'lat', type: 'decimal', writable: true },
    { field: 'lng', column: 'lng', type: 'decimal', writable: true },
    { field: 'tz', column: 'tz', type: 'text', writable: true },
    { field: 'arriveOn', column: 'arrive_on', type: 'date', writable: true },
    { field: 'departOn', column: 'depart_on', type: 'date', writable: true },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async derive(merged) {
    const problems = []
    if (
      typeof merged.arriveOn === 'string' &&
      typeof merged.departOn === 'string' &&
      merged.departOn < merged.arriveOn
    ) {
      problems.push({ field: 'departOn', rule: 'afterOrEqual' })
    }
    return { columns: {}, problems }
  },
}
