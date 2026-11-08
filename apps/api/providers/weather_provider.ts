import type { ApplicationService } from '@adonisjs/core/types'
import { WeatherProvider } from '#services/weather/weather_provider'

/**
 * Binds the `WeatherProvider` implementation chosen by `WEATHER_PROVIDER`
 * (default `off`): `open-meteo`, `fake` or `off`. Resolved lazily so the
 * env is validated first and tests can swap the binding.
 */
export default class WeatherProviderBinding {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(WeatherProvider, async () => {
      const { default: env } = await import('#start/env')
      const choice = env.get('WEATHER_PROVIDER') ?? 'off'
      if (choice === 'open-meteo') {
        const { OpenMeteoProvider } = await import('#services/weather/open_meteo_provider')
        return new OpenMeteoProvider()
      }
      if (choice === 'fake') {
        const { FakeWeatherProvider } = await import('#services/weather/fake_weather_provider')
        return new FakeWeatherProvider()
      }
      const { OffWeatherProvider } = await import('#services/weather/off_weather_provider')
      return new OffWeatherProvider()
    })
  }
}
