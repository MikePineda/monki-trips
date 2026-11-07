/**
 * Stops on the wire. The entity shape lives in `domain/trip_stop.ts`
 * (`TripStop`); this module adds the stored columns.
 */
import type { IsoDate } from './domain/iso_date.ts'
import type { TripStop } from './domain/trip_stop.ts'
import type { IsoInstant } from './domain/zoned_instant.ts'

/**
 * A stop as the API returns it. Unlike the domain's `TripStop` (a stop the
 * pipelines can locate), a stored stop may still lack its zone and dates
 * while it is being planned; `offsetMin` is resolved by the caller at `now`
 * and never stored.
 */
export interface TripStopRow extends Omit<TripStop, 'tz' | 'arriveOn' | 'departOn' | 'offsetMin'> {
  tripId: string
  lat: number | null
  lng: number | null
  /** IANA time zone of the stop. */
  tz: string | null
  arriveOn: IsoDate | null
  departOn: IsoDate | null
  deletedAt: IsoInstant | null
  updatedAt: IsoInstant
}
