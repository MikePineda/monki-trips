import type { TaskRecord } from '../app/core/offline/records'

/** A synthetic task of trip `trip-1`, open, undated and normal unless overridden. */
export function taskFixture(overrides: Partial<TaskRecord> & Pick<TaskRecord, 'id'>): TaskRecord {
  return {
    tripId: 'trip-1',
    eventId: null,
    title: `Task ${overrides.id}`,
    titleKey: null,
    notes: null,
    dueOn: null,
    priority: 'normal',
    doneAt: null,
    doneBy: null,
    origin: 'manual',
    sourceDocumentId: null,
    templateItemKey: null,
    updatedAt: '2026-11-07T10:00:00.000Z',
    ...overrides,
  }
}
