import type { TripTaskRow } from '@monkitrips/shared'
import { toTaskRecord } from './task-record'

const ROW: TripTaskRow = {
  id: 'k1',
  tripId: 't1',
  eventId: null,
  title: 'Check passport validity',
  titleKey: null,
  notes: null,
  dueOn: '2027-01-10',
  priority: 'high',
  doneAt: null,
  doneBy: null,
  origin: 'manual',
  sourceDocumentId: null,
  templateItemKey: null,
  deletedAt: null,
  updatedAt: '2026-11-07T12:00:00.000Z',
}

describe('toTaskRecord', () => {
  it('copies the wire row without its tombstone', () => {
    const record = toTaskRecord(ROW)

    expect(record).not.toHaveProperty('deletedAt')
    expect(record).toMatchObject({ id: 'k1', title: 'Check passport validity', priority: 'high' })
  })

  it('a checklist item stays a checklist item when the server does not store the template key yet', () => {
    const local = {
      ...toTaskRecord(ROW),
      origin: 'template' as const,
      titleKey: 'template.documents.passport',
      templateItemKey: 'documents.passport',
    }

    const record = toTaskRecord(ROW, local)

    expect(record.templateItemKey).toBe('documents.passport')
    expect(record.titleKey).toBe('template.documents.passport')
    expect(record.origin).toBe('template')
  })

  it('the server template key wins once it exists', () => {
    const local = { ...toTaskRecord(ROW), templateItemKey: 'old.key' }

    const record = toTaskRecord({ ...ROW, origin: 'template', templateItemKey: 'gear.esim' }, local)

    expect(record.templateItemKey).toBe('gear.esim')
    expect(record.origin).toBe('template')
  })
})
