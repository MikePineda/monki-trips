import { Injectable, InjectionToken, inject } from '@angular/core'
import type { WeatherSnapshot } from '@monkitrips/shared'
import { MetaStore } from './meta.store'

/** The few conditions Today draws, each with its own icon and words. */
export const WEATHER_CONDITIONS = ['clear', 'cloudy', 'rain', 'snow', 'storm'] as const

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number]

/** What the device caches for a trip: the current conditions at the stop and when they were read. */
export interface TripWeather extends WeatherSnapshot {
  temperatureC: number
  condition: WeatherCondition
}

export interface WeatherPlace {
  lat: number
  lng: number
}

/**
 * Where the weather comes from. The real Open-Meteo adapter lands with
 * WP 2.9; until then the app's provider has nothing to say and Today
 * hides the row. Specs swap in `FakeWeatherProvider` (src/testing).
 */
export interface WeatherProvider {
  current(place: WeatherPlace): Promise<Omit<TripWeather, 'updatedAt'> | null>
}

export const WEATHER_PROVIDER = new InjectionToken<WeatherProvider>('WEATHER_PROVIDER', {
  providedIn: 'root',
  factory: () => ({ current: async () => null }),
})

/** The meta key of a trip's cached weather. */
export function weatherKey(tripId: string): string {
  return `weather.${tripId}`
}

/**
 * Refreshes a trip's cached weather from the provider. A provider that
 * fails or has nothing leaves the cache alone: old weather with its age is
 * more useful offline than none.
 */
@Injectable({ providedIn: 'root' })
export class WeatherStore {
  private readonly provider = inject(WEATHER_PROVIDER)
  private readonly meta = inject(MetaStore)

  async refresh(tripId: string, place: WeatherPlace, now: string): Promise<TripWeather | null> {
    let reading: Omit<TripWeather, 'updatedAt'> | null
    try {
      reading = await this.provider.current(place)
    } catch {
      return null
    }
    if (!reading) {
      return null
    }
    const weather: TripWeather = { ...reading, updatedAt: now }
    await this.meta.set(weatherKey(tripId), weather)
    return weather
  }
}
