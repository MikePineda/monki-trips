import type { EmergencyRecord, TaskRecord } from './records'
import { mergePendingRow } from './pending-merge'

const TASK: TaskRecord = {
  id: 'k1',
  tripId: 't1',
  eventId: null,
  title: 'Local title',
  titleKey: null,
  notes: null,
  dueOn: '2027-01-10',
  priority: 'high',
  doneAt: null,
  doneBy: null,
  origin: 'manual',
  sourceDocumentId: null,
  templateItemKey: null,
  updatedAt: '2026-11-07T12:00:00.000Z',
  syncState: 'pending',
}

describe('mergePendingRow', () => {
  it('takes the server row but keeps the fields still pending on the device', () => {
    const server: TaskRecord = {
      ...TASK,
      title: 'Server title',
      priority: 'low',
      syncState: undefined,
    }

    const merged = mergePendingRow('tasks', TASK, server, new Set(['priority']))

    expect(merged).toEqual({ ...server, priority: 'high', syncState: 'pending' })
  })

  it('emergency fields merge per key', () => {
    const local: EmergencyRecord = {
      id: 't1',
      tripId: 't1',
      content: {
        insurance: { provider: 'Mine', policyNumber: null, phone: null },
        notes: 'local notes',
      },
      schemaVersion: 1,
      updatedAt: 'x',
      syncState: 'pending',
    }
    const server: EmergencyRecord = {
      ...local,
      syncState: undefined,
      content: {
        insurance: { provider: 'Theirs', policyNumber: null, phone: null },
        medical: { notes: 'allergies' },
        notes: 'server notes',
      },
      updatedAt: 'y',
    }

    const merged = mergePendingRow('emergency', local, server, new Set(['notes']))

    expect(merged.content).toEqual({
      insurance: { provider: 'Theirs', policyNumber: null, phone: null },
      medical: { notes: 'allergies' },
      notes: 'local notes',
    })
    expect(merged.syncState).toBe('pending')
    expect(merged.updatedAt).toBe('y')
  })
})
