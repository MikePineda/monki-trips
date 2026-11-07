import { Injectable, inject, signal } from '@angular/core'
import type { CreateTripInput, Trip } from '@monkitrips/shared'
import { v7 as uuidv7 } from 'uuid'
import { ApiFailure } from '../../core/api/api-failure'
import { TRIPS_API } from '../../core/api/trips-api'
import { OFFLINE_DB } from '../../core/offline/offline-db'
import { liveSignal } from '../../core/offline/live'
import { OnlineStore } from '../../core/offline/online.store'
import type { TripRecord } from '../../core/offline/records'
import { toTripRecord } from '../../core/offline/trip-record'
import { SessionStore } from '../../core/session/session.store'

export type NewTripInput = Omit<CreateTripInput, 'id'>

/**
 * The trips on this device, newest change first, straight from Dexie: the
 * list never waits for the network. `refresh()` asks `GET /trips` and
 * replaces the device's rows with the server's live list; `create()` posts
 * a trip with a client id (idempotent on retry) and caches it. A 401 while
 * online ends the session; any other failure is kept for the page to show
 * next to the saved data.
 */
@Injectable({ providedIn: 'root' })
export class TripsStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly api = inject(TRIPS_API)
  private readonly online = inject(OnlineStore)
  private readonly session = inject(SessionStore)

  readonly trips = liveSignal<TripRecord[]>(
    (db) => db.trips.orderBy('updatedAt').reverse().toArray(),
    []
  )
  readonly refreshing = signal(false)
  /** The failure of the last refresh, null after a good one (or while offline). */
  readonly failure = signal<ApiFailure | null>(null)

  /** Pulls the live list when online; offline the device's copy stands. */
  async refresh(): Promise<void> {
    if (!this.online.online()) {
      return
    }
    this.refreshing.set(true)
    try {
      const list = await this.api.list()
      const ids = new Set(list.map((trip) => trip.id))
      const db = await this.database
      await db.transaction('rw', db.trips, async () => {
        const stale = (await db.trips.toCollection().primaryKeys()).filter((id) => !ids.has(id))
        await db.trips.bulkDelete(stale)
        await db.trips.bulkPut(list.map((trip) => toTripRecord(trip)))
      })
      this.failure.set(null)
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        this.failure.set(failure)
      }
    } finally {
      this.refreshing.set(false)
    }
  }

  /** Creates the trip on the server and on the device; the ApiFailure reaches the caller. */
  async create(input: NewTripInput): Promise<Trip> {
    const trip = await this.api.create({ id: uuidv7(), ...input })
    // The creator owns the trip until the members table (sync) says otherwise.
    await (await this.database).trips.put(toTripRecord({ ...trip, role: 'owner', memberCount: 1 }))
    return trip
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
