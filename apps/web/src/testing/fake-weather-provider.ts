import type { TripWeather, WeatherPlace, WeatherProvider } from '../app/core/offline/weather'

/** A weather provider that answers what the spec scripted, and remembers where it was asked. */
export class FakeWeatherProvider implements WeatherProvider {
  readonly asked: WeatherPlace[] = []
  next: Omit<TripWeather, 'updatedAt'> | null = { temperatureC: 18, condition: 'rain' }
  fail = false

  async current(place: WeatherPlace): Promise<Omit<TripWeather, 'updatedAt'> | null> {
    this.asked.push(place)
    if (this.fail) {
      throw new Error('weather provider unavailable')
    }
    return this.next
  }
}
