import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import { RealActivityApi } from './real-activity-api'

/** What a change did to its row. */
export type ActivityAction = 'created' | 'updated' | 'deleted'

/**
 * One line of `GET /trips/:tripId/activity`: who changed which row, how,
 * and the names of the fields that changed (never their values). The shape
 * follows the `trip_activity` table of the API; it moves to
 * `@monkitrips/shared` with the route itself.
 */
export interface TripActivityEntry {
  /** The server's identity, as a string (a Postgres bigint). */
  id: string
  tripId: string
  actorUserId: string | null
  /** Display name of the actor, or null for an account that is gone. */
  actorName: string | null
  entity: string
  entityId: string
  action: ActivityAction
  fields: string[]
  /** ISO instant. */
  createdAt: string
}

/** A page of the feed, newest first; `nextCursor` null on the last page. */
export interface ActivityPage {
  entries: TripActivityEntry[]
  nextCursor: string | null
}

/**
 * The activity feed of a trip, paged by an opaque cursor (`metadata.nextCursor`
 * of the list envelope). Failures are ApiFailures.
 */
export interface ActivityApi {
  page(tripId: string, cursor: string | null): Promise<ActivityPage>
}

export const ACTIVITY_API = new InjectionToken<ActivityApi>('ACTIVITY_API', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT)
    return new RealActivityApi(
      () => document.defaultView?.fetch.bind(document.defaultView) ?? fetch,
      () => document.documentElement.lang || undefined
    )
  },
})
