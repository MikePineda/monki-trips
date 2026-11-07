/**
 * The numbers of the trip card: state for `today`, days and nights, where
 * it stands relative to today, and the distinct countries of its stops.
 */
import { daysBetween, type IsoDate } from './iso_date.ts'
import {
  tripDayNumber,
  tripNightDates,
  tripPhase,
  tripTotalDays,
  type TripDates,
  type TripPhase,
} from './trip_dates.ts'
import { sortedStops, type TripStop } from './trip_stop.ts'

export interface TripSummary {
  phase: TripPhase
  totalDays: number
  nights: number
  /** 1-based while ongoing, else null. */
  dayNumber: number | null
  /** Days until departure while upcoming, else null. */
  daysUntilStart: number | null
  /** Days since the last day while past, else null. */
  daysSinceEnd: number | null
  stopCount: number
  /** Distinct country codes in itinerary order. */
  countries: string[]
  countryCount: number
}

export function tripSummary(
  trip: TripDates,
  stops: readonly Pick<TripStop, 'position' | 'countryCode'>[],
  today: IsoDate
): TripSummary {
  const phase = tripPhase(trip, today)
  const countries: string[] = []
  for (const stop of sortedStops(stops)) {
    if (stop.countryCode && !countries.includes(stop.countryCode)) {
      countries.push(stop.countryCode)
    }
  }
  return {
    phase,
    totalDays: tripTotalDays(trip),
    nights: tripNightDates(trip).length,
    dayNumber: tripDayNumber(trip, today),
    daysUntilStart: phase === 'upcoming' ? daysBetween(today, trip.startsOn) : null,
    daysSinceEnd: phase === 'past' ? daysBetween(trip.endsOn, today) : null,
    stopCount: stops.length,
    countries,
    countryCount: countries.length,
  }
}
