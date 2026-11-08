import type { IsoDate, TripWeather } from '@monkitrips/shared'
import type { WeatherProvider } from '../offline/weather'
import type { ApiClientLoader } from './api'
import { apiCall } from './api-failure'

/** `WeatherProvider` over the typed client: `GET /trips/:tripId/weather?date=`. */
export class RealWeatherApi implements WeatherProvider {
  constructor(private readonly client: ApiClientLoader) {}

  async day(tripId: string, date: IsoDate): Promise<TripWeather | null> {
    const api = await this.client()
    const { data } = await apiCall(() =>
      api.request('trips.weather', { params: { tripId }, query: { date } })
    )
    return data ?? null
  }
}
