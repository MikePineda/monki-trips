import { InjectionToken } from '@angular/core'
import type { MonkiTripsDb } from './db'

/**
 * The device's database, once Dexie has loaded. Dexie is a third of the
 * app's startup code, so it arrives in its own chunk: consumers `await` the
 * token (`const db = await this.database`) and route guards wait for it
 * before deciding. The promise is shared; the database opens on first use.
 */
export const OFFLINE_DB = new InjectionToken<Promise<MonkiTripsDb>>('OFFLINE_DB', {
  providedIn: 'root',
  factory: () => import('./db').then(({ MonkiTripsDb }) => new MonkiTripsDb()),
})
