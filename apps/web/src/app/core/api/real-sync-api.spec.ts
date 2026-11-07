import type { SyncPullOutput, SyncPushOutput, TripTaskRow } from '@monkitrips/shared'
import type { OutboxRecord } from '../offline/records'
import { SyncCursorExpired } from '../offline/sync-api'
import type { ApiClient } from './api'
import { ApiFailure } from './api-failure'
import { RealSyncApi } from './real-sync-api'

const TASK_ROW: TripTaskRow = {
  id: 'k1',
  tripId: 't1',
  eventId: null,
  title: 'Buy an adapter',
  titleKey: null,
  notes: null,
  dueOn: null,
  priority: 'normal',
  doneAt: null,
  doneBy: null,
  origin: 'manual',
  sourceDocumentId: null,
  templateItemKey: null,
  deletedAt: null,
  updatedAt: '2026-11-07T12:00:00.000Z',
}

function entry(id: string, payload: unknown, kind = 'task.upsert'): OutboxRecord {
  return {
    id,
    tripId: 't1',
    kind,
    payload,
    state: 'syncing',
    attempts: 0,
    createdAt: '2026-11-07T12:00:00.000Z',
    nextAttemptAt: null,
    error: null,
  }
}

const UPSERT = {
  entity: 'task',
  op: 'upsert',
  id: 'k1',
  changes: { title: 'Buy an adapter' },
  changedAt: '2026-11-07T12:00:00.000Z',
}

/** A stand-in for the typed client: records requests, answers what the spec scripted. */
function clientWith(answers: { pull?: () => SyncPullOutput; push?: () => SyncPushOutput }) {
  const requests: { route: string; options: unknown }[] = []
  const client = {
    request: async (route: string, options: unknown) => {
      requests.push({ route, options })
      if (route === 'sync.pull' && answers.pull) {
        return { data: answers.pull() }
      }
      if (route === 'sync.push' && answers.push) {
        return { data: answers.push() }
      }
      throw new Error(`unexpected request ${route}`)
    },
  }
  return { requests, loader: async () => client as unknown as ApiClient }
}

describe('RealSyncApi', () => {
  it('pulls with the cursor and turns the page into device rows, skipping entities without a table yet', async () => {
    const { requests, loader } = clientWith({
      pull: () => ({
        changes: [
          { entity: 'task', row: TASK_ROW },
          { entity: 'task', row: { ...TASK_ROW, id: 'k2', deletedAt: '2026-11-07T12:00:00.000Z' } },
          {
            entity: 'stop',
            row: { id: 's1', tripId: 't1' } as never,
          },
        ],
        tripIds: ['t1'],
        cursor: 'c2',
        hasMore: false,
      }),
    })

    const result = await new RealSyncApi(loader).pull('c1')

    expect(requests).toEqual([{ route: 'sync.pull', options: { query: { cursor: 'c1' } } }])
    expect(result.cursor).toBe('c2')
    expect(result.tripIds).toEqual(['t1'])
    expect(result.changes).toEqual([
      { table: 'tasks', row: expect.objectContaining({ id: 'k1', title: 'Buy an adapter' }) },
      { table: 'tasks', row: { id: 'k2' }, deleted: true },
    ])
  })

  it('pulls travellers into the device travellers table, tombstones included', async () => {
    const traveller = {
      id: 'tr1',
      tripId: 't1',
      displayName: 'Little one',
      userId: null,
      position: 2,
      deletedAt: null,
      updatedAt: '2026-11-07T12:00:00.000Z',
    }
    const { loader } = clientWith({
      pull: () => ({
        changes: [
          { entity: 'traveller', row: traveller },
          {
            entity: 'traveller',
            row: { ...traveller, id: 'tr2', deletedAt: '2026-11-07T12:00:00.000Z' },
          },
        ],
        tripIds: ['t1'],
        cursor: 'c2',
        hasMore: false,
      }),
    })

    const result = await new RealSyncApi(loader).pull('c1')

    expect(result.changes).toEqual([
      {
        table: 'travellers',
        row: {
          id: 'tr1',
          tripId: 't1',
          displayName: 'Little one',
          userId: null,
          position: 2,
          updatedAt: '2026-11-07T12:00:00.000Z',
        },
      },
      { table: 'travellers', row: { id: 'tr2' }, deleted: true },
    ])
  })

  it('a first pull sends no cursor', async () => {
    const { requests, loader } = clientWith({
      pull: () => ({ changes: [], tripIds: [], cursor: 'c1', hasMore: false }),
    })

    await new RealSyncApi(loader).pull(null)

    expect(requests[0].options).toEqual({ query: {} })
  })

  it('an expired cursor (410) is reported as such', async () => {
    const loader = async () =>
      ({
        request: async () => {
          throw new ApiFailure({
            kind: 'http',
            status: 410,
            code: 'E_SYNC_CURSOR_EXPIRED',
            message: 'gone',
          })
        },
      }) as unknown as ApiClient

    await expect(new RealSyncApi(loader).pull('old')).rejects.toBeInstanceOf(SyncCursorExpired)
  })

  it('pushes outbox entries as mutations and maps every result status', async () => {
    const { requests, loader } = clientWith({
      push: () => ({
        results: [
          { mutationId: 'm1', status: 'applied', row: TASK_ROW },
          { mutationId: 'm2', status: 'duplicate', row: TASK_ROW },
          {
            mutationId: 'm3',
            status: 'partial',
            rejectedFields: ['title'],
            row: { ...TASK_ROW, title: 'Server title' },
          },
          {
            mutationId: 'm4',
            status: 'rejected',
            error: { code: 'E_ROW_DELETED', message: 'deleted' },
            row: { ...TASK_ROW, deletedAt: 'x' },
          },
          {
            mutationId: 'm5',
            status: 'rejected',
            error: { code: 'E_VALIDATION_ERROR', message: 'The title is too long' },
          },
        ],
      }),
    })

    const result = await new RealSyncApi(loader).push([
      entry('m1', UPSERT),
      entry('m2', UPSERT),
      entry('m3', UPSERT),
      entry('m4', UPSERT),
      entry('m5', UPSERT),
      entry('m6', { amountMinor: 1250 }, 'expense.create'),
    ])

    const body = (requests[0].options as { body: { mutations: unknown[] } }).body
    expect(body.mutations).toHaveLength(5)
    expect(body.mutations[0]).toEqual({ mutationId: 'm1', tripId: 't1', ...UPSERT })
    expect(result.accepted).toEqual(['m1', 'm2'])
    expect(result.conflicts).toEqual([
      {
        id: 'm3',
        serverRow: { table: 'tasks', row: expect.objectContaining({ title: 'Server title' }) },
      },
      { id: 'm4', serverRow: { table: 'tasks', row: { id: 'k1' }, deleted: true } },
    ])
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { id: 'm5', message: 'The title is too long' },
        { id: 'm6', message: 'Unsupported outbox entry: expense.create' },
      ])
    )
    expect(result.rejected).toHaveLength(2)
  })
})
