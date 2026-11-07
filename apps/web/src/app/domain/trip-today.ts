import { localToday } from './local-today'
import { stopForDate, type DatedStop } from './stop-for-date'

/** Where "today" is read: the date, the zone and the hour of the place the person is in. */
export interface TripToday {
  date: string
  zone: string
  hour: number
}

/**
 * Today for a trip: the device's date picks the stop being visited, and
 * that stop's zone gives the place's date and hour (the device keeps its
 * home zone while abroad). Without a covering stop with a zone, the device
 * zone. Pure: the instant and both zones are passed in.
 */
export function tripToday(
  now: string,
  deviceZone: string,
  stops: readonly (DatedStop & { tz: string | null })[]
): TripToday {
  const stop = stopForDate(stops, localToday(now, deviceZone))
  const zone = stop?.tz ?? deviceZone
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).format(
      new Date(Date.parse(now))
    )
  )
  return { date: localToday(now, zone), zone, hour }
}
