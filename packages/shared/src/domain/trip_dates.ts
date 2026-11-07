/**
 * The calendar window of a trip: `startsOn` .. `endsOn` inclusive, both
 * `YYYY-MM-DD`. Its state (`upcoming`, `ongoing`, `past`) is derived from
 * `today`, never stored.
 */
import { addDays, compareIsoDate, daysBetween, isoDateRange, type IsoDate } from './iso_date.ts'

export interface TripDates {
  startsOn: IsoDate
  endsOn: IsoDate
}

export const TRIP_PHASES = ['upcoming', 'ongoing', 'past'] as const

export type TripPhase = (typeof TRIP_PHASES)[number]

/** Where `today` falls relative to the trip. */
export function tripPhase(trip: TripDates, today: IsoDate): TripPhase {
  if (compareIsoDate(today, trip.startsOn) < 0) {
    return 'upcoming'
  }
  if (compareIsoDate(today, trip.endsOn) > 0) {
    return 'past'
  }
  return 'ongoing'
}

/** Number of calendar days of the trip, both ends included (a one-day trip is 1). */
export function tripTotalDays(trip: TripDates): number {
  return daysBetween(trip.startsOn, trip.endsOn) + 1
}

/** The nights of the trip, named after the day they start: `startsOn` .. `endsOn − 1`. A one-day trip has none. */
export function tripNightDates(trip: TripDates): IsoDate[] {
  return isoDateRange(trip.startsOn, trip.endsOn)
}

/** 1-based day of the trip for `today`, or null outside it. */
export function tripDayNumber(trip: TripDates, today: IsoDate): number | null {
  if (tripPhase(trip, today) !== 'ongoing') {
    return null
  }
  return daysBetween(trip.startsOn, today) + 1
}

/** True when `date` is one of the trip's nights (there is a "tonight" to sleep somewhere). */
export function isTripNight(trip: TripDates, date: IsoDate): boolean {
  return (
    compareIsoDate(date, trip.startsOn) >= 0 && compareIsoDate(date, addDays(trip.endsOn, -1)) <= 0
  )
}
