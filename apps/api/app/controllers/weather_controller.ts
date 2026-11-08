import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, TripWeather } from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import { TripWeatherService } from '#services/weather/trip_weather_service'
import { WeatherUnavailableError } from '#services/weather/weather_provider'
import { weatherQueryValidator } from '#validators/weather'

/**
 * `GET /trips/:tripId/weather?date=`: the weather of the place the trip is
 * at on that local date (members only). `data` is null when nothing is
 * known for that day; a provider outage with nothing cached answers 503
 * `E_WEATHER_UNAVAILABLE`.
 */
@inject()
export default class WeatherController {
  constructor(private readonly weather: TripWeatherService) {}

  async show(ctx: HttpContext): Promise<ApiEnvelope<TripWeather | null>> {
    const { date } = await weatherQueryValidator.validate(ctx.request.qs(), {
      meta: undefined,
      messagesProvider: ctx.i18n.createMessagesProvider(),
    })
    try {
      return { data: await this.weather.on(ctx.trip, date) }
    } catch (error) {
      if (error instanceof WeatherUnavailableError) throw new ApiException('E_WEATHER_UNAVAILABLE')
      throw error
    }
  }
}
