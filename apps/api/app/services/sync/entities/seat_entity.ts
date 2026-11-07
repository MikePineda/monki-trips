import type { EntitySpec } from '#services/sync/entity_spec'
import { seatChanges } from '#validators/sync/entities'

/** A traveller's seat on a segment; the segment and the traveller never change afterwards. */
export const seatEntity: EntitySpec = {
  entity: 'seat',
  table: 'segment_seats',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: seatChanges,
  requiredOnInsert: ['segmentId', 'travellerId'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    {
      field: 'segmentId',
      column: 'segment_id',
      type: 'text',
      writable: true,
      immutable: true,
      references: 'event_segments',
    },
    {
      field: 'travellerId',
      column: 'traveller_id',
      type: 'text',
      writable: true,
      immutable: true,
      references: 'travellers',
    },
    { field: 'seat', column: 'seat', type: 'text', writable: true },
    { field: 'coach', column: 'coach', type: 'text', writable: true },
    { field: 'ticketNumber', column: 'ticket_number', type: 'text', writable: true },
    {
      field: 'documentId',
      column: 'document_id',
      type: 'text',
      writable: true,
      references: 'documents',
    },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
}
