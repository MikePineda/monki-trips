import { inject } from '@angular/core'
import { Router, type CanActivateFn } from '@angular/router'
import { TRIPS_API } from '../api/trips-api'
import { META_DEVICE_USER, MetaStore } from '../offline/meta.store'
import { OFFLINE_DB } from '../offline/offline-db'
import { OnlineStore } from '../offline/online.store'
import { toTripRecord } from '../offline/trip-record'
import { SessionStore } from './session.store'

/** Where a trip the person is not a member of lands: "not found", never "forbidden". */
export const TRIP_NOT_FOUND_URL = '/not-found'

/**
 * The trip is the tenant boundary. A trip already in Dexie is one of ours
 * when the device's data belongs to the signed-in account; an unknown trip
 * (or one cached by another account of this device) is fetched from the
 * server when online and, if we are a member, cached so the shell can show
 * it. A foreign one is "not found" (the API says 404, never 403); offline,
 * another account's copy is "not found" too. Offline with no copy, the page
 * itself says the trip is not available yet. A 401 means the session ended.
 */
export const tripMemberGuard: CanActivateFn = async (route, state) => {
  const tripId = route.paramMap.get('tripId')
  const router = inject(Router)
  const database = inject(OFFLINE_DB)
  const online = inject(OnlineStore)
  const api = inject(TRIPS_API)
  const session = inject(SessionStore)
  const meta = inject(MetaStore)
  if (!tripId) {
    return router.createUrlTree(['/trips'])
  }

  const db = await database
  // Guards run side by side: wait for the session (it may claim the device) before reading the owner.
  const user = await session.restore()
  const [cached, owner] = await Promise.all([
    db.trips.get(tripId),
    meta.get<string>(META_DEVICE_USER),
  ])
  const ours = user !== null && owner === user.id
  if (cached && ours) {
    return true
  }
  if (!online.online()) {
    return cached ? router.createUrlTree([TRIP_NOT_FOUND_URL]) : true
  }

  try {
    const snapshot = await api.snapshot(tripId)
    if (!snapshot) {
      return router.createUrlTree([TRIP_NOT_FOUND_URL])
    }
    await db.trips.put(toTripRecord(snapshot.trip))
    return true
  } catch (error) {
    if (await session.handleUnauthorized(error, state.url)) {
      return false
    }
    // No answer (or a verification wall): let the page explain instead of guessing.
    return true
  }
}
