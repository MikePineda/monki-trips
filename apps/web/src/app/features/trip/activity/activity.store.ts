import { Injectable, computed, inject, signal } from '@angular/core'
import { ACTIVITY_API, type TripActivityEntry } from '../../../core/api/activity-api'
import { ApiFailure } from '../../../core/api/api-failure'
import { OFFLINE_DB } from '../../../core/offline/offline-db'
import { OnlineStore } from '../../../core/offline/online.store'
import type { ActivityRecord } from '../../../core/offline/records'
import { SessionStore } from '../../../core/session/session.store'

/** Lines kept per trip on the device: the newest ones. */
export const ACTIVITY_CACHE_LIMIT = 300

/**
 * The feed of one trip, for one page instance (provided by the page): the
 * first page refreshes the device's cache, "load more" follows the cursor
 * and appends. The page reads the lines from Dexie, so offline it shows
 * what the device saved. A 401 while online ends the session; any other
 * failure is kept for the page to show next to the saved lines.
 */
@Injectable()
export class ActivityStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly api = inject(ACTIVITY_API)
  private readonly online = inject(OnlineStore)
  private readonly session = inject(SessionStore)

  readonly refreshing = signal(false)
  readonly loadingMore = signal(false)
  readonly failure = signal<ApiFailure | null>(null)
  private readonly nextCursor = signal<string | null>(null)
  readonly hasMore = computed(() => this.nextCursor() !== null)

  /** The newest page from the server; offline the device's copy stands. */
  async refresh(tripId: string): Promise<void> {
    if (!this.online.online()) {
      return
    }
    this.refreshing.set(true)
    await this.fetch(tripId, null)
    this.refreshing.set(false)
  }

  /** The page after the last one received. */
  async loadMore(tripId: string): Promise<void> {
    const cursor = this.nextCursor()
    if (cursor === null || !this.online.online()) {
      return
    }
    this.loadingMore.set(true)
    await this.fetch(tripId, cursor)
    this.loadingMore.set(false)
  }

  private async fetch(tripId: string, cursor: string | null): Promise<void> {
    try {
      const page = await this.api.page(tripId, cursor)
      await this.cache(tripId, page.entries)
      this.nextCursor.set(page.nextCursor)
      this.failure.set(null)
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        this.failure.set(failure)
      }
    }
  }

  private async cache(tripId: string, entries: TripActivityEntry[]): Promise<void> {
    const db = await this.database
    await db.transaction('rw', db.activity, async () => {
      await db.activity.bulkPut(entries.map((entry) => toRecord(tripId, entry)))
      const kept = await db.activity
        .where('[tripId+createdAt]')
        .between([tripId, ''], [tripId, '￿'])
        .reverse()
        .primaryKeys()
      if (kept.length > ACTIVITY_CACHE_LIMIT) {
        await db.activity.bulkDelete(kept.slice(ACTIVITY_CACHE_LIMIT))
      }
    })
  }
}

function toRecord(tripId: string, entry: TripActivityEntry): ActivityRecord {
  return {
    id: String(entry.id),
    tripId,
    actorUserId: entry.actorUserId,
    actorName: entry.actorName,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    fields: entry.fields ?? [],
    createdAt: entry.createdAt,
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
