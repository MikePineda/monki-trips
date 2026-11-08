import { addDays, type TripWeather } from '@monkitrips/shared'
import type { WeatherProvider } from '../app/core/offline/weather'
import { tripWeatherFixture } from './weather-fixtures'

/** A weather provider that answers what the spec scripted, and remembers which days it was asked. */
export class FakeWeatherProvider implements WeatherProvider {
  readonly asked: { tripId: string; date: string }[] = []
  /** The answer for a date; the fixture moved to that date by default. */
  answer: (date: string) => TripWeather | null = (date) =>
    tripWeatherFixture({
      date,
      daily: tripWeatherFixture().daily.map((day, index) => ({
        ...day,
        date: addDays(date, index),
      })),
    })
  fail = false

  async day(tripId: string, date: string): Promise<TripWeather | null> {
    this.asked.push({ tripId, date })
    if (this.fail) {
      throw new Error('weather provider unavailable')
    }
    return this.answer(date)
  }
}
