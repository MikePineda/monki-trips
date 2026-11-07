import { inject } from '@angular/core'
import { Router, type CanActivateFn } from '@angular/router'
import { OFFLINE_DB } from '../offline/db'
import { OnlineStore } from '../offline/online.store'
import { SESSION_API } from './session-api'

/**
 * The trip is the tenant boundary. A trip already in Dexie is one of ours;
 * an unknown trip is checked with the server when online, and a foreign one
 * is "not found" (back to the list, never a 403 screen). Offline with no
 * copy, the page itself says the trip is not available yet.
 */
export const tripMemberGuard: CanActivateFn = async (route) => {
  const tripId = route.paramMap.get('tripId')
  const router = inject(Router)
  const db = inject(OFFLINE_DB)
  const online = inject(OnlineStore)
  const api = inject(SESSION_API)
  if (!tripId) {
    return router.createUrlTree(['/trips'])
  }

  const cached = await db.trips.get(tripId)
  if (cached || !online.online()) {
    return true
  }

  const allowed = await api.canOpenTrip(tripId).catch(() => true)
  return allowed ? true : router.createUrlTree(['/trips'])
}
