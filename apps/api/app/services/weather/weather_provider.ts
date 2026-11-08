import type { WeatherAttribution, WeatherForecast } from '@monkitrips/shared'

/** Coordinates the provider is asked about, already rounded for the shared cache. */
export interface WeatherCoordinates {
  lat: number
  lng: number
}

/**
 * Source of forecasts. The container binds the implementation chosen by
 * `WEATHER_PROVIDER` (`providers/weather_provider.ts`): `open-meteo` calls
 * the public Open-Meteo API (no key), `fake` answers fixed fixtures (tests,
 * offline development), `off` answers nothing so Today hides the row.
 * Only coordinates are ever sent: no trip, place name or person.
 */
export abstract class WeatherProvider {
  /** Who to credit for the data (the Open-Meteo licence requires it). */
  abstract readonly attribution: WeatherAttribution

  /**
   * The forecast at the place from its local today, or null when weather
   * is switched off. Throws `WeatherUnavailableError` when the source
   * cannot answer.
   */
  abstract forecast(place: WeatherCoordinates): Promise<WeatherForecast | null>
}

/** The provider could not answer (network, timeout, upstream error, a malformed body). */
export class WeatherUnavailableError extends Error {
  constructor(message = 'weather unavailable') {
    super(message)
    this.name = 'WeatherUnavailableError'
  }
}
