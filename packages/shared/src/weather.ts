/**
 * The weather of a trip day on the wire (`GET /trips/:tripId/weather?date=`).
 * The domain shapes (`WeatherNow`, `WeatherDay`, `WeatherCondition`) live in
 * `domain/weather_forecast.ts` and `domain/weather_condition.ts`.
 */
import type { IsoDate } from './domain/iso_date.ts'
import type { WeatherDay, WeatherNow } from './domain/weather_forecast.ts'
import type { IsoInstant } from './domain/zoned_instant.ts'

/** Who the data comes from; the licence (CC BY 4.0 for Open-Meteo) asks the app to say so. */
export interface WeatherAttribution {
  name: string
  url: string | null
}

export interface TripWeather {
  /** The trip day asked for. */
  date: IsoDate
  /** Where it was read: the stop covering the day, or that night's lodging. */
  place: { stopId: string | null; name: string }
  /** Conditions right now, only when `date` is the place's today. */
  current: WeatherNow | null
  /** `date` and up to two days after it. */
  daily: WeatherDay[]
  /** When the server read the forecast from the provider. */
  fetchedAt: IsoInstant
  attribution: WeatherAttribution
}
