import type { TripWeather } from '@monkitrips/shared'

/** A synthetic answer of `GET /trips/:tripId/weather` for an invented harbour town. */
export function tripWeatherFixture(overrides: Partial<TripWeather> = {}): TripWeather {
  return {
    date: '2027-01-21',
    place: { stopId: 'stop-1', name: 'Port Vellmar' },
    current: { temperatureC: 17.6, condition: 'rain', precipitationMm: 1.2 },
    daily: [
      {
        date: '2027-01-21',
        condition: 'rain',
        maxC: 21.4,
        minC: 12.6,
        precipitationProbabilityPct: 80,
      },
      {
        date: '2027-01-22',
        condition: 'partly_cloudy',
        maxC: 23,
        minC: 14,
        precipitationProbabilityPct: 20,
      },
      {
        date: '2027-01-23',
        condition: 'clear',
        maxC: 25,
        minC: 15,
        precipitationProbabilityPct: 0,
      },
    ],
    fetchedAt: '2027-01-21T02:00:00.000Z',
    attribution: { name: 'Open-Meteo.com', url: 'https://open-meteo.com/' },
    ...overrides,
  }
}
