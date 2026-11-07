import { InjectionToken } from '@angular/core'

/**
 * The device's IANA time zone, the zone "today" is read in until a trip
 * stop says otherwise. Injectable so specs pin it instead of following
 * the machine that runs them.
 */
export const TIME_ZONE = new InjectionToken<string>('TIME_ZONE', {
  providedIn: 'root',
  factory: () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
})
