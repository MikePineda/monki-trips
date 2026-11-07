/**
 * A place the trip stays at or passes through, in order. Stops feed the
 * route chips, the map and the passport stamps; their zone is the one Today
 * follows while the trip is there.
 */
export interface Stop {
  id: string
  tripId: string
  position: number
  name: string
  /** ISO 3166-1 alpha-2, uppercase, or null when unknown. */
  countryCode: string | null
  lat: number | null
  lng: number | null
  /** IANA time zone of the stop. */
  tz: string | null
  arriveOn: string | null
  departOn: string | null
  deletedAt: string | null
  updatedAt: string
}
