import { tripWeatherFixture } from '../../../testing/weather-fixtures'
import type { ApiClient } from './api'
import { ApiFailure } from './api-failure'
import { RealWeatherApi } from './real-weather-api'

function clientWith(answer: () => unknown) {
  const requests: { route: string; options: unknown }[] = []
  const client = {
    request: async (route: string, options: unknown) => {
      requests.push({ route, options })
      return answer()
    },
  }
  return { requests, loader: async () => client as unknown as ApiClient }
}

describe('RealWeatherApi', () => {
  it('asks the weather of a trip day and returns the answer', async () => {
    const weather = tripWeatherFixture()
    const { requests, loader } = clientWith(() => ({ data: weather }))

    expect(await new RealWeatherApi(loader).day('trip-1', '2027-01-21')).toEqual(weather)
    expect(requests).toEqual([
      {
        route: 'trips.weather',
        options: { params: { tripId: 'trip-1' }, query: { date: '2027-01-21' } },
      },
    ])
  })

  it('a day the server knows nothing about is null', async () => {
    const { loader } = clientWith(() => ({ data: null }))

    expect(await new RealWeatherApi(loader).day('trip-1', '2027-01-21')).toBeNull()
  })

  it('an outage surfaces as an ApiFailure', async () => {
    const { loader } = clientWith(() => {
      throw new ApiFailure({
        kind: 'http',
        status: 503,
        code: 'E_WEATHER_UNAVAILABLE',
        message: 'unavailable',
      })
    })

    await expect(new RealWeatherApi(loader).day('trip-1', '2027-01-21')).rejects.toBeInstanceOf(
      ApiFailure
    )
  })
})
