import { Injectable, InjectionToken, inject } from '@angular/core'
import {
  addDays,
  type IsoDate,
  type TripDates,
  type TripWeather,
  type WeatherSnapshot,
} from '@monkitrips/shared'
import { API } from '../api/api'
import { RealWeatherApi } from '../api/real-weather-api'
import { MetaStore } from './meta.store'

/** Days ahead the provider forecasts (Open-Meteo's longest forecast). */
export const FORECAST_DAYS = 16

/**
 * What the device keeps for one trip day: the API's answer, with its
 * `fetchedAt` as `updatedAt`, the age Today shows ("updated 3 h ago").
 */
export interface CachedWeather extends TripWeather, WeatherSnapshot {}

/**
 * Where the weather comes from: `GET /trips/:tripId/weather?date=` through
 * the typed client. Null when the server knows nothing for that day; a
 * failure throws. Specs swap in `FakeWeatherProvider` (src/testing).
 */
export interface WeatherProvider {
  day(tripId: string, date: IsoDate): Promise<TripWeather | null>
}

export const WEATHER_PROVIDER = new InjectionToken<WeatherProvider>('WEATHER_PROVIDER', {
  providedIn: 'root',
  factory: () => new RealWeatherApi(inject(API)),
})

/** The meta key of a trip day's cached weather. */
export function weatherKey(tripId: string, date: IsoDate): string {
  return `weather.${tripId}.${date}`
}

/** The trip days from `today` the forecast can reach (at most 16), in order. */
export function forecastDates(trip: TripDates, today: IsoDate): IsoDate[] {
  const last = addDays(today, FORECAST_DAYS - 1)
  const dates: IsoDate[] = []
  for (let date = trip.startsOn > today ? trip.startsOn : today; date <= trip.endsOn;) {
    if (date > last) {
      break
    }
    dates.push(date)
    date = addDays(date, 1)
  }
  return dates
}

/**
 * Keeps each trip day's weather on the device. A provider that fails or
 * has nothing for the day leaves the cache alone: old weather with its age
 * is more useful offline than none.
 */
@Injectable({ providedIn: 'root' })
export class WeatherStore {
  private readonly provider = inject(WEATHER_PROVIDER)
  private readonly meta = inject(MetaStore)

  async refresh(tripId: string, date: IsoDate): Promise<CachedWeather | null> {
    let answer: TripWeather | null
    try {
      answer = await this.provider.day(tripId, date)
    } catch {
      return null
    }
    if (!answer) {
      return null
    }
    const weather: CachedWeather = { ...answer, updatedAt: answer.fetchedAt }
    await this.meta.set(weatherKey(tripId, date), weather)
    return weather
  }

  /** Saves several days one after the other ("Download everything"). */
  async refreshDays(
    tripId: string,
    dates: readonly IsoDate[]
  ): Promise<{ saved: number; failed: number }> {
    let saved = 0
    let failed = 0
    for (const date of dates) {
      if (await this.refresh(tripId, date)) {
        saved += 1
      } else {
        failed += 1
      }
    }
    return { saved, failed }
  }
}
