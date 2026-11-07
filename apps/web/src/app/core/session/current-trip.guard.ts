import { inject } from '@angular/core'
import { Router, type CanActivateFn } from '@angular/router'
import { META_ACTIVE_TRIP, MetaStore } from '../offline/meta.store'

/**
 * `/t/current/...` (the manifest's "Add expense" shortcut) resolves to the
 * active trip remembered in Dexie meta and redirects there; with none, to
 * the trip list. Always redirects: the route has no component of its own.
 */
export const currentTripGuard: CanActivateFn = async (route) => {
  const router = inject(Router)
  const meta = inject(MetaStore)
  const activeTripId = await meta.get<string>(META_ACTIVE_TRIP)
  if (!activeTripId) {
    return router.createUrlTree(['/trips'])
  }
  // The matched segments are `t`, `current` and whatever follows.
  const rest = route.url.map((segment) => segment.path).slice(2)
  return router.createUrlTree(['/t', activeTripId, ...rest])
}
