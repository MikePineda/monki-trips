import { Injectable, inject } from '@angular/core'
import { OFFLINE_DB } from '../../core/offline/db'
import { liveSignal } from '../../core/offline/live'
import type { TripRecord } from '../../core/offline/records'

/**
 * The trips on this device, newest change first, straight from Dexie: the
 * list never waits for the network (the sync service refills the table).
 */
@Injectable({ providedIn: 'root' })
export class TripsStore {
  private readonly db = inject(OFFLINE_DB)

  readonly trips = liveSignal<TripRecord[]>(
    () => this.db.trips.orderBy('updatedAt').reverse().toArray(),
    []
  )
}
