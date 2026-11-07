import type { TripDocumentRow } from '@monkitrips/shared'
import { toDocumentRecord } from './document-record'

describe('toDocumentRecord', () => {
  const row: TripDocumentRow = {
    id: 'doc-1',
    tripId: 'trip-1',
    eventId: 'event-1',
    kind: 'file',
    title: 'Ferry voucher',
    url: null,
    mime: 'application/pdf',
    sizeBytes: 2048,
    sha256: 'abc',
    tags: ['print'],
    availableOffline: false,
    uploadedBy: 'user-1',
    deletedAt: null,
    updatedAt: '2026-11-07T00:00:00.000Z',
  }

  it('keeps every wire field but the tombstone', () => {
    expect(toDocumentRecord(row)).toEqual({
      id: 'doc-1',
      tripId: 'trip-1',
      eventId: 'event-1',
      kind: 'file',
      title: 'Ferry voucher',
      url: null,
      mime: 'application/pdf',
      sizeBytes: 2048,
      sha256: 'abc',
      tags: ['print'],
      availableOffline: false,
      uploadedBy: 'user-1',
      updatedAt: '2026-11-07T00:00:00.000Z',
    })
    expect('deletedAt' in toDocumentRecord(row)).toBe(false)
  })

  it('tags missing on the wire become an empty list', () => {
    expect(toDocumentRecord({ ...row, tags: undefined as unknown as [] }).tags).toEqual([])
  })
})
