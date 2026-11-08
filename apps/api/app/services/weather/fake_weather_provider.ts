import { DateTime } from 'luxon'
import type { WeatherDay, WeatherForecast } from '@monkitrips/shared'
import {
  WeatherProvider,
  WeatherUnavailableError,
  type WeatherCoordinates,
} from '#services/weather/weather_provider'

/** Days the fake forecasts, like the real provider's longest forecast. */
const FAKE_DAYS = 16

/**
 * Fixed forecasts for tests and offline development (`WEATHER_PROVIDER=fake`):
 * every day is light rain, 24° / 16° with a 40 % chance of rain, from the
 * UTC date of `now`; the current reading is 21.4° and partly cloudy.
 * Synthetic numbers, not weather data. `unavailable` makes every call fail
 * like an outage; `calls` records where it was asked.
 */
export class FakeWeatherProvider extends WeatherProvider {
  readonly attribution = { name: 'monki-trips fake weather', url: null }

  unavailable = false
  readonly calls: WeatherCoordinates[] = []

  constructor(private readonly now: () => Date = () => new Date()) {
    super()
  }

  async forecast(place: WeatherCoordinates): Promise<WeatherForecast> {
    this.calls.push(place)
    if (this.unavailable) throw new WeatherUnavailableError('fake provider is unavailable')
    const today = DateTime.fromJSDate(this.now()).toUTC().startOf('day')
    const daily: WeatherDay[] = Array.from({ length: FAKE_DAYS }, (_, index) => ({
      date: today.plus({ days: index }).toISODate()!,
      condition: 'rain',
      maxC: 24,
      minC: 16,
      precipitationProbabilityPct: 40,
    }))
    return {
      timezone: 'UTC',
      current: { temperatureC: 21.4, condition: 'partly_cloudy', precipitationMm: 0.2 },
      daily,
    }
  }
}
