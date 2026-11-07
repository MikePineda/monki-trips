import { compareIsoDate, type IsoDate } from '@monkitrips/shared'

/** What a stop needs to say whether a date is spent there. */
export interface DatedStop {
  countryCode: string | null
  arriveOn: IsoDate | null
  departOn: IsoDate | null
  position: number
}

/**
 * The stop a date is spent in: the one whose stay covers it, and on a day
 * that moves from one stop to the next, the one arrived at (the later
 * `arriveOn`). Null when no stop covers the date (before or after the
 * trip, or a gap). Pure.
 */
export function stopForDate<S extends DatedStop>(stops: readonly S[], date: IsoDate): S | null {
  const covering = stops.filter(
    (stop) =>
      stop.arriveOn !== null &&
      stop.departOn !== null &&
      compareIsoDate(stop.arriveOn, date) <= 0 &&
      compareIsoDate(date, stop.departOn) <= 0
  )
  if (covering.length === 0) {
    return null
  }
  return covering.reduce((latest, stop) =>
    compareIsoDate(stop.arriveOn!, latest.arriveOn!) > 0 ||
    (compareIsoDate(stop.arriveOn!, latest.arriveOn!) === 0 && stop.position > latest.position)
      ? stop
      : latest
  )
}
