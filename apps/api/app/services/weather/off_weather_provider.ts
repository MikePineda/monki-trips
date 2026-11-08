import type { WeatherForecast } from '@monkitrips/shared'
import { WeatherProvider } from '#services/weather/weather_provider'

/** `WEATHER_PROVIDER=off`: no forecasts, never a network call; Today hides the weather row. */
export class OffWeatherProvider extends WeatherProvider {
  readonly attribution = { name: 'none', url: null }

  async forecast(): Promise<WeatherForecast | null> {
    return null
  }
}
