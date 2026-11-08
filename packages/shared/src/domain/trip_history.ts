/**
 * The trip list as a travel history: trips grouped by where `today` falls
 * (upcoming, ongoing, past) and the trip whose end the mascot still
 * celebrates. Pure; `today` is the caller's local date.
 */
import { compareIsoDate, type IsoDate } from './iso_date.ts'
import { isCelebrating } from './mascot_state.ts'
import { tripPhase, type TripDates } from './trip_dates.ts'

export interface HistoryGroups<T> {
  /** Next departure first. */
  upcoming: T[]
  /** Earliest start first. */
  ongoing: T[]
  /** Latest return first. */
  past: T[]
}

type HistoryTrip = TripDates & { id: string }

export function historyGroups<T extends HistoryTrip>(
  trips: readonly T[],
  today: IsoDate
): HistoryGroups<T> {
  const groups: HistoryGroups<T> = { upcoming: [], ongoing: [], past: [] }
  for (const trip of trips) {
    groups[tripPhase(trip, today)].push(trip)
  }
  const byStart = (a: T, b: T) => compareIsoDate(a.startsOn, b.startsOn) || a.id.localeCompare(b.id)
  groups.upcoming.sort(byStart)
  groups.ongoing.sort(byStart)
  groups.past.sort(
    (a, b) => compareIsoDate(b.endsOn, a.endsOn) || compareIsoDate(b.startsOn, a.startsOn)
  )
  return groups
}

/**
 * The trip that just earned its stamps: the latest trip that has started,
 * when it ended within the celebration window (`CELEBRATION_DAYS`).
 * Null while a newer trip is already under way.
 */
export function celebratedTrip<T extends HistoryTrip>(
  trips: readonly T[],
  today: IsoDate
): T | null {
  let latest: T | null = null
  for (const trip of trips) {
    if (compareIsoDate(trip.startsOn, today) > 0) {
      continue
    }
    if (
      !latest ||
      compareIsoDate(trip.startsOn, latest.startsOn) > 0 ||
      (trip.startsOn === latest.startsOn && compareIsoDate(trip.endsOn, latest.endsOn) > 0)
    ) {
      latest = trip
    }
  }
  return latest && isCelebrating(latest, today) ? latest : null
}
