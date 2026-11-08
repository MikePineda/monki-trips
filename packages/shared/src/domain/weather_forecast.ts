/**
 * A place's forecast as the weather provider reads it (normalised, codes
 * already mapped to `WeatherCondition`), and the slice of it one trip day
 * shows: that day and the two after it, plus the current conditions when
 * the day is the place's today (the forecast's first day).
 */
import type { IsoDate } from './iso_date.ts'
import type { WeatherCondition } from './weather_condition.ts'

export interface WeatherNow {
  temperatureC: number
  condition: WeatherCondition
  precipitationMm: number
}

export interface WeatherDay {
  /** Local date at the place. */
  date: IsoDate
  condition: WeatherCondition
  maxC: number
  minC: number
  /** Highest chance of rain that day, 0..100, or null when the provider has none. */
  precipitationProbabilityPct: number | null
}

export interface WeatherForecast {
  /** IANA zone the provider read the place's days in. */
  timezone: string
  current: WeatherNow | null
  /** Consecutive days from the place's today. */
  daily: WeatherDay[]
}

/** Days a trip day shows: itself and the next two. */
export const WEATHER_DAYS_SHOWN = 3

/** The current conditions and the days from `date`, or null when the forecast does not reach it. */
export function forecastOn(
  forecast: WeatherForecast,
  date: IsoDate
): { current: WeatherNow | null; daily: WeatherDay[] } | null {
  const index = forecast.daily.findIndex((day) => day.date === date)
  if (index < 0) {
    return null
  }
  return {
    current: index === 0 ? forecast.current : null,
    daily: forecast.daily.slice(index, index + WEATHER_DAYS_SHOWN),
  }
}
