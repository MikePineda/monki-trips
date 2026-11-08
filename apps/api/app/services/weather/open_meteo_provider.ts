import { weatherCondition, type WeatherDay, type WeatherForecast } from '@monkitrips/shared'
import {
  WeatherProvider,
  WeatherUnavailableError,
  type WeatherCoordinates,
} from '#services/weather/weather_provider'

/** Open-Meteo's public forecast API; no key, coordinates only. */
export const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1'

/** Open-Meteo's longest forecast; one call covers every trip day it can know. */
export const OPEN_METEO_FORECAST_DAYS = 16

export interface OpenMeteoOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  /** Per attempt. */
  timeoutMs?: number
  /** Waits before each retry; its length is the number of retries. */
  retryDelaysMs?: number[]
  sleep?: (ms: number) => Promise<void>
}

/** Thrown inside the retry loop for answers worth another try (network, timeout, 429, 5xx). */
class RetryableError extends WeatherUnavailableError {}

interface OpenMeteoBody {
  timezone?: unknown
  current?: { temperature_2m?: unknown; weather_code?: unknown; precipitation?: unknown }
  daily?: {
    time?: unknown
    weather_code?: unknown
    temperature_2m_max?: unknown
    temperature_2m_min?: unknown
    precipitation_probability_max?: unknown
  }
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function at(list: unknown, index: number): unknown {
  return Array.isArray(list) ? list[index] : undefined
}

/**
 * Forecasts from Open-Meteo (`WEATHER_PROVIDER=open-meteo`): `GET
 * /v1/forecast` with the current temperature, weather code and
 * precipitation, and 16 days of max/min, rain probability and weather code,
 * in the place's own zone (`timezone=auto`). Each attempt times out; 429,
 * 5xx and network failures are retried with backoff, anything else fails at
 * once. The free tier is for non-commercial use and asks for attribution
 * (docs/SELF_HOSTING.md).
 */
export class OpenMeteoProvider extends WeatherProvider {
  readonly attribution = { name: 'Open-Meteo.com', url: 'https://open-meteo.com/' }

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly retryDelaysMs: number[]
  private readonly sleep: (ms: number) => Promise<void>

  constructor(options: OpenMeteoOptions = {}) {
    super()
    this.baseUrl = options.baseUrl ?? OPEN_METEO_BASE_URL
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 5000
    this.retryDelaysMs = options.retryDelaysMs ?? [250, 1000]
    this.sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  }

  async forecast(place: WeatherCoordinates): Promise<WeatherForecast> {
    const url = new URL(`${this.baseUrl}/forecast`)
    url.searchParams.set('latitude', String(place.lat))
    url.searchParams.set('longitude', String(place.lng))
    url.searchParams.set('current', 'temperature_2m,weather_code,precipitation')
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'
    )
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('forecast_days', String(OPEN_METEO_FORECAST_DAYS))

    for (let attempt = 0; ; attempt += 1) {
      try {
        return parse(await this.attempt(url))
      } catch (error) {
        const delay = this.retryDelaysMs[attempt]
        if (!(error instanceof RetryableError) || delay === undefined) {
          if (error instanceof WeatherUnavailableError) {
            throw new WeatherUnavailableError(error.message)
          }
          throw error
        }
        await this.sleep(delay)
      }
    }
  }

  private async attempt(url: URL): Promise<OpenMeteoBody> {
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      throw new RetryableError(`open-meteo unreachable: ${(error as Error).name}`)
    }
    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel()
      throw new RetryableError(`open-meteo answered ${response.status}`)
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new WeatherUnavailableError(`open-meteo answered ${response.status}`)
    }
    try {
      return (await response.json()) as OpenMeteoBody
    } catch (error) {
      throw new RetryableError(`open-meteo body unreadable: ${(error as Error).name}`)
    }
  }
}

function parse(body: OpenMeteoBody): WeatherForecast {
  const times = body?.daily?.time
  if (!Array.isArray(times) || typeof body.timezone !== 'string') {
    throw new WeatherUnavailableError('open-meteo answered without daily data')
  }
  const daily: WeatherDay[] = []
  times.forEach((date, index) => {
    const maxC = at(body.daily?.temperature_2m_max, index)
    const minC = at(body.daily?.temperature_2m_min, index)
    const code = at(body.daily?.weather_code, index)
    const rain = at(body.daily?.precipitation_probability_max, index)
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    if (!finite(maxC) || !finite(minC)) return
    daily.push({
      date,
      condition: weatherCondition(finite(code) ? code : -1),
      maxC,
      minC,
      precipitationProbabilityPct: finite(rain) ? rain : null,
    })
  })
  const current = body.current
  return {
    timezone: body.timezone,
    current:
      current && finite(current.temperature_2m)
        ? {
            temperatureC: current.temperature_2m,
            condition: weatherCondition(finite(current.weather_code) ? current.weather_code : -1),
            precipitationMm: finite(current.precipitation) ? current.precipitation : 0,
          }
        : null,
    daily,
  }
}
