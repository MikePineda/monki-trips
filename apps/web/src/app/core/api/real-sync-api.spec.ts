import type {
  TripDocumentRow,
  SyncPullOutput,
  SyncPushOutput,
  TripTaskRow,
} from '@monkitrips/shared'
import type { OutboxRecord } from '../offline/records'
import { SyncCursorExpired } from '../offline/sync-api'
import type { ApiClient } from './api'
import { ApiFailure } from './api-failure'
import { RealSyncApi } from './real-sync-api'
import { blankEvent, blankSeat, blankSegment, blankStop } from '../../../testing/fake-trip-content'
import { budgetCategoryRow, expenseRow } from '../../../testing/money-fixtures'

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
            entity: 'an_entity_from_a_newer_server',
            row: { id: 's1', tripId: 't1' },
          } as never,
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

  it('pulls expense shares into the device expenseShares table, tombstones included', async () => {
    const share = {
      id: 's1',
      tripId: 't1',
      expenseId: 'x1',
      travellerId: 'v1',
      shareMinor: 4500,
      deletedAt: null,
      updatedAt: '2026-11-07T10:00:00.000Z',
    }
    const { loader } = clientWith({
      pull: () => ({
        changes: [
          { entity: 'expense_share', row: share },
          {
            entity: 'expense_share',
            row: { ...share, id: 's2', deletedAt: '2026-11-07T11:00:00.000Z' },
          },
        ],
        tripIds: ['t1'],
        cursor: 'c2',
        hasMore: false,
      }),
    })

    const result = await new RealSyncApi(loader).pull(null)

    expect(result.changes).toEqual([
      {
        table: 'expenseShares',
        row: {
          id: 's1',
          tripId: 't1',
          expenseId: 'x1',
          travellerId: 'v1',
          shareMinor: 4500,
          updatedAt: '2026-11-07T10:00:00.000Z',
        },
      },
      { table: 'expenseShares', row: { id: 's2' }, deleted: true },
    ])
  })

  it('pulls phrase cards into the device phraseCards table, tombstones included', async () => {
    const set = {
      id: 'p1',
      tripId: 't1',
      language: 'th',
      cards: [
        {
          category: 'greetings',
          prompt: 'Hello',
          phrase: 'สวัสดี',
          romanization: null,
          note: null,
        },
      ],
      model: 'fake-phrase-model',
      createdBy: null,
      deletedAt: null,
      updatedAt: '2026-11-07T10:00:00.000Z',
    }
    const { loader } = clientWith({
      pull: () => ({
        changes: [
          { entity: 'phrase_card', row: set },
          {
            entity: 'phrase_card',
            row: { ...set, id: 'p0', deletedAt: '2026-11-07T09:00:00.000Z' },
          },
        ],
        tripIds: ['t1'],
        cursor: 'c2',
        hasMore: false,
      }),
    })

    const result = await new RealSyncApi(loader).pull(null)

    expect(result.changes).toEqual([
      {
        table: 'phraseCards',
        row: {
          id: 'p1',
          tripId: 't1',
          language: 'th',
          cards: [
            {
              category: 'greetings',
              prompt: 'Hello',
              phrase: 'สวัสดี',
              romanization: null,
              note: null,
            },
          ],
          updatedAt: '2026-11-07T10:00:00.000Z',
        },
      },
      { table: 'phraseCards', row: { id: 'p0' }, deleted: true },
    ])
  })

  it('pulls documents into the device docs table, tombstones included', async () => {
    const document: TripDocumentRow = {
      id: 'd1',
      tripId: 't1',
      eventId: null,
      kind: 'file',
      title: 'Ferry voucher',
      url: null,
      mime: 'application/pdf',
      sizeBytes: 10,
      sha256: 'abc',
      tags: ['print'],
      availableOffline: false,
      uploadedBy: 'u1',
      deletedAt: null,
      updatedAt: '2026-11-07T00:00:00.000Z',
    }
    const { loader } = clientWith({
      pull: () => ({
        changes: [
          { entity: 'document', row: document },
          {
            entity: 'document',
            row: { ...document, id: 'd2', deletedAt: '2026-11-07T12:00:00.000Z' },
          },
        ],
        tripIds: ['t1'],
        cursor: 'c2',
        hasMore: false,
      }),
    })

    const result = await new RealSyncApi(loader).pull(null)

    const { deletedAt, ...kept } = document
    void deletedAt
    expect(result.changes).toEqual([
      { table: 'docs', row: kept },
      { table: 'docs', row: { id: 'd2' }, deleted: true },
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
  it('hands back the live shares the server keeps for a pushed expense, refused or not', async () => {
    const share = {
      id: 's1',
      tripId: 't1',
      expenseId: 'x1',
      travellerId: 'v1',
      shareMinor: 1250,
      deletedAt: null,
      updatedAt: '2026-11-07T10:00:00.000Z',
    }
    const { loader } = clientWith({
      push: () => ({
        results: [
          {
            mutationId: 'm1',
            status: 'rejected',
            error: { code: 'E_VALIDATION_ERROR', message: 'The shares must add up' },
            row: { id: 'x1' } as never,
            shares: [share],
          },
        ],
      }),
    })
    const expense = {
      entity: 'expense',
      op: 'upsert',
      id: 'x1',
      changes: { shares: [] },
      changedAt: '2026-11-07T12:00:00.000Z',
    }

    const result = await new RealSyncApi(loader).push([entry('m1', expense, 'expense.upsert')])

    expect(result.expenseShares).toEqual([
      {
        expenseId: 'x1',
        shares: [
          {
            id: 's1',
            tripId: 't1',
            expenseId: 'x1',
            travellerId: 'v1',
            shareMinor: 1250,
            updatedAt: '2026-11-07T10:00:00.000Z',
          },
        ],
      },
    ])
  })

  it('pulls the itinerary rows into their tables: stops, events, legs and seats', async () => {
    const event = blankEvent({ id: 'e1', tripId: 't1', title: 'Flight out' })
    const { loader } = clientWith({
      pull: () => ({
        changes: [
          { entity: 'stop', row: blankStop({ id: 's1', tripId: 't1' }) },
          { entity: 'event', row: event },
          { entity: 'event', row: { ...event, id: 'e2', deletedAt: '2026-11-07T12:00:00.000Z' } },
          { entity: 'segment', row: blankSegment({ id: 'g1', tripId: 't1', eventId: 'e1' }) },
          { entity: 'seat', row: blankSeat({ id: 'st1', tripId: 't1', segmentId: 'g1' }) },
        ],
        tripIds: ['t1'],
        cursor: 'c2',
        hasMore: false,
      }),
    })

    const result = await new RealSyncApi(loader).pull(null)

    expect(result.changes).toEqual([
      { table: 'stops', row: expect.objectContaining({ id: 's1', name: 'Port Vellmar' }) },
      { table: 'events', row: expect.objectContaining({ id: 'e1', title: 'Flight out' }) },
      { table: 'events', row: { id: 'e2' }, deleted: true },
      { table: 'segments', row: expect.objectContaining({ id: 'g1', eventId: 'e1' }) },
      { table: 'seats', row: expect.objectContaining({ id: 'st1', segmentId: 'g1' }) },
    ])
    for (const change of result.changes) {
      expect(change.row).not.toHaveProperty('deletedAt')
    }
  })

  it('pulls expenses and budget categories into their tables, tombstones included', async () => {
    const { loader } = clientWith({
      pull: () => ({
        changes: [
          { entity: 'budget_category', row: budgetCategoryRow({ id: 'c1', tripId: 't1' }) },
          {
            entity: 'expense',
            row: expenseRow({ id: 'x1', tripId: 't1', baseAmountMinor: null, fxRate: null }),
          },
          {
            entity: 'expense',
            row: expenseRow({ id: 'x2', tripId: 't1', deletedAt: '2026-11-07T12:00:00.000Z' }),
          },
        ],
        tripIds: ['t1'],
        cursor: 'c2',
        hasMore: false,
      }),
    })

    const result = await new RealSyncApi(loader).pull(null)

    expect(result.changes).toEqual([
      { table: 'budgetCategories', row: expect.objectContaining({ id: 'c1', key: 'other' }) },
      { table: 'expenses', row: expect.objectContaining({ id: 'x1', baseAmountMinor: null }) },
      { table: 'expenses', row: { id: 'x2' }, deleted: true },
    ])
    for (const change of result.changes) {
      expect(change.row).not.toHaveProperty('deletedAt')
    }
  })
})
