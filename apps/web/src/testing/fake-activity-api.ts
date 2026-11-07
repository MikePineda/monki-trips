import type { ActivityApi, ActivityPage, TripActivityEntry } from '../app/core/api/activity-api'
import { FakeApi } from './fake-api'

/** A synthetic feed line. */
export function fakeActivityEntry(overrides: Partial<TripActivityEntry> = {}): TripActivityEntry {
  return {
    id: '1',
    tripId: 'trip-1',
    actorUserId: 'partner',
    actorName: 'Partner',
    entity: 'task',
    entityId: 'task-1',
    action: 'updated',
    fields: ['doneAt'],
    createdAt: '2026-11-07T11:30:00.000Z',
    ...overrides,
  }
}

/**
 * In-memory feed: `pages` maps a cursor (`null` for the first page) to the
 * entries it answers and the cursor of the page after it.
 */
export class FakeActivityApi extends FakeApi implements ActivityApi {
  pages = new Map<string | null, ActivityPage>()

  page(tripId: string, cursor: string | null): Promise<ActivityPage> {
    return this.run(`activity:${tripId}:${cursor ?? 'first'}`, () => {
      const page = this.pages.get(cursor)
      return page
        ? {
            entries: page.entries.filter((entry) => entry.tripId === tripId),
            nextCursor: page.nextCursor,
          }
        : { entries: [], nextCursor: null }
    })
  }
}
