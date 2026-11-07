import { inject } from '@angular/core'
import { Router, type CanActivateFn } from '@angular/router'
import { tripPhase } from '@monkitrips/shared'
import { localToday } from '../../domain/local-today'
import { CLOCK } from '../offline/clock'
import { TIME_ZONE } from '../offline/time-zone'
import { OFFLINE_DB } from '../offline/offline-db'

/**
 * `/t/:tripId` on its own opens Today while the trip is ongoing and the
 * summary otherwise (an upcoming trip is planned, a past one is read).
 * "Today" is the device's calendar date. Always redirects: the route has
 * no component of its own.
 */
export const tripHomeGuard: CanActivateFn = async (route) => {
  const router = inject(Router)
  const database = inject(OFFLINE_DB)
  const clock = inject(CLOCK)
  const zone = inject(TIME_ZONE)
  const tripId = route.paramMap.get('tripId') ?? ''
  const trip = await (await database).trips.get(tripId)
  const today = localToday(clock(), zone)
  const ongoing =
    trip !== undefined &&
    tripPhase({ startsOn: trip.startDate, endsOn: trip.endDate }, today) === 'ongoing'
  return router.createUrlTree(['/t', tripId, ongoing ? 'today' : 'summary'])
}
