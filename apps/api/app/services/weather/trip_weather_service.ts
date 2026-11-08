import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import {
  forecastOn,
  roundCoordinate,
  weatherPlaceOn,
  type IsoDate,
  type TripWeather,
  type WeatherAttribution,
  type WeatherForecast,
} from '@monkitrips/shared'
import type Trip from '#models/trip'
import { Clock } from '#services/clock'
import { TripContent } from '#services/trip_content'
import { WeatherProvider, WeatherUnavailableError } from '#services/weather/weather_provider'

/** How long a place's forecast is reused before the provider is asked again. */
export const WEATHER_CACHE_MS = 30 * 60 * 1000

interface SnapshotPayload {
  forecast: WeatherForecast
  attribution: WeatherAttribution
}

interface Snapshot {
  fetchedAt: Date
  payload: SnapshotPayload
}

/**
 * The weather of one trip day: the place from the trip's stops (or that
 * night's lodging), its forecast from `weather_snapshots` while younger
 * than 30 minutes, else from the provider. When the provider fails, an
 * older snapshot still answers with its own `fetchedAt`; with none, it
 * throws `WeatherUnavailableError`. Null when the trip has no placed stop
 * or lodging that day, the forecast does not reach the date, or weather is
 * switched off.
 */
@inject()
export class TripWeatherService {
  constructor(
    private readonly clock: Clock,
    private readonly content: TripContent,
    private readonly provider: WeatherProvider
  ) {}

  async on(trip: Trip, date: IsoDate): Promise<TripWeather | null> {
    const { stops, events } = await this.content.load(trip.id)
    const place = weatherPlaceOn(date, stops, events)
    if (!place) return null
    const coordinates = { lat: roundCoordinate(place.lat), lng: roundCoordinate(place.lng) }

    const cached = await this.cached(coordinates.lat, coordinates.lng)
    const now = this.clock.now()
    const fresh = cached && now.getTime() - cached.fetchedAt.getTime() < WEATHER_CACHE_MS
    const snapshot = fresh ? cached : await this.refresh(coordinates, now, cached)
    if (!snapshot) return null

    const day = forecastOn(snapshot.payload.forecast, date)
    if (!day) return null
    return {
      date,
      place: { stopId: place.stopId, name: place.name },
      current: day.current,
      daily: day.daily,
      fetchedAt: snapshot.fetchedAt.toISOString(),
      attribution: snapshot.payload.attribution,
    }
  }

  /** A new snapshot from the provider; on an outage the old one, if any, stands in. */
  private async refresh(
    coordinates: { lat: number; lng: number },
    now: Date,
    stale: Snapshot | null
  ): Promise<Snapshot | null> {
    let forecast: WeatherForecast | null
    try {
      forecast = await this.provider.forecast(coordinates)
    } catch (error) {
      if (error instanceof WeatherUnavailableError && stale) return stale
      throw error
    }
    if (!forecast) return null
    const snapshot: Snapshot = {
      fetchedAt: new Date(now.getTime()),
      payload: { forecast, attribution: this.provider.attribution },
    }
    await this.store(coordinates.lat, coordinates.lng, snapshot)
    return snapshot
  }

  private async cached(lat: number, lng: number): Promise<Snapshot | null> {
    const row = (await db
      .from('weather_snapshots')
      .where({ lat, lng })
      .select('fetched_at', 'payload')
      .first()) as { fetched_at: Date; payload: SnapshotPayload } | null
    return row ? { fetchedAt: new Date(row.fetched_at), payload: row.payload } : null
  }

  private async store(lat: number, lng: number, snapshot: Snapshot): Promise<void> {
    await db
      .table('weather_snapshots')
      .insert({
        lat,
        lng,
        fetched_at: snapshot.fetchedAt,
        payload: JSON.stringify(snapshot.payload),
      })
      .onConflict(['lat', 'lng'])
      .merge(['fetched_at', 'payload'])
  }
}
