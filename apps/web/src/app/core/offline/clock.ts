import { InjectionToken } from '@angular/core'

/** Returns the current instant as an ISO string. */
export type Clock = () => string

/**
 * The injectable "now" of the offline core, so specs fix time instead of
 * reading the system clock.
 */
export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date().toISOString(),
})
