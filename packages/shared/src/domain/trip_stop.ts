/**
 * A stop of the trip (a place where the travellers stay for some days), the
 * row of `stops`. `offsetMin` is optional and only needed by the pipelines
 * that locate `now`: it is the UTC offset of `tz` at that `now`, resolved by
 * the caller.
 */
import type { IsoDate } from './iso_date.ts'

export interface TripStop {
  id: string
  position: number
  name: string
  /** ISO 3166-1 alpha-2, uppercase, or null when unknown. */
  countryCode: string | null
  /** IANA zone of the place; carried for display, never interpreted here. */
  tz: string
  arriveOn: IsoDate
  departOn: IsoDate
  /** UTC offset of `tz` at the caller's `now`, minutes east of UTC. */
  offsetMin?: number
}

/** Stops ordered by position. */
export function sortedStops<T extends Pick<TripStop, 'position'>>(stops: readonly T[]): T[] {
  return [...stops].sort((a, b) => a.position - b.position)
}
