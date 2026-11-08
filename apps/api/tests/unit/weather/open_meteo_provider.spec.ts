import { test } from '@japa/runner'
import { createServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { OpenMeteoProvider } from '#services/weather/open_meteo_provider'
import { WeatherUnavailableError } from '#services/weather/weather_provider'

type Handler = (url: URL, response: ServerResponse) => void

/** An Open-Meteo stand-in on 127.0.0.1: answers each request with the next handler (the last repeats). */
async function fakeOpenMeteo(handlers: Handler[]) {
  const received: URL[] = []
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    received.push(url)
    handlers[Math.min(received.length - 1, handlers.length - 1)](url, response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

const json =
  (status: number, body: unknown): Handler =>
  (_url, response) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }

/** The shape `/v1/forecast` answers for the parameters the provider sends (synthetic values). */
const FORECAST_BODY = {
  latitude: 10.125,
  longitude: 120.625,
  generationtime_ms: 0.1,
  utc_offset_seconds: 28800,
  timezone: 'Asia/Manila',
  timezone_abbreviation: 'GMT+8',
  elevation: 4,
  current_units: { time: 'iso8601', temperature_2m: '°C', weather_code: 'wmo code' },
  current: {
    time: '2027-01-20T14:15',
    interval: 900,
    temperature_2m: 29.3,
    weather_code: 80,
    precipitation: 0.4,
  },
  daily_units: { time: 'iso8601', temperature_2m_max: '°C' },
  daily: {
    time: ['2027-01-20', '2027-01-21', '2027-01-22'],
    weather_code: [80, 2, 95],
    temperature_2m_max: [31.2, 30.1, 28.4],
    temperature_2m_min: [24.5, 23.9, 23.1],
    precipitation_probability_max: [70, 10, null],
  },
}

const noWait = async () => {}

test.group('Open-Meteo provider', () => {
  test('asks the forecast endpoint for coordinates only and maps the answer', async ({
    assert,
  }) => {
    const endpoint = await fakeOpenMeteo([json(200, FORECAST_BODY)])
    try {
      const provider = new OpenMeteoProvider({ baseUrl: endpoint.baseUrl, sleep: noWait })
      const forecast = await provider.forecast({ lat: 10.12, lng: 120.65 })

      const url = endpoint.received[0]
      assert.equal(url.pathname, '/v1/forecast')
      assert.deepEqual(Object.fromEntries(url.searchParams), {
        latitude: '10.12',
        longitude: '120.65',
        current: 'temperature_2m,weather_code,precipitation',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
        timezone: 'auto',
        forecast_days: '16',
      })
      assert.deepEqual(forecast, {
        timezone: 'Asia/Manila',
        current: { temperatureC: 29.3, condition: 'rain', precipitationMm: 0.4 },
        daily: [
          {
            date: '2027-01-20',
            condition: 'rain',
            maxC: 31.2,
            minC: 24.5,
            precipitationProbabilityPct: 70,
          },
          {
            date: '2027-01-21',
            condition: 'partly_cloudy',
            maxC: 30.1,
            minC: 23.9,
            precipitationProbabilityPct: 10,
          },
          {
            date: '2027-01-22',
            condition: 'thunderstorm',
            maxC: 28.4,
            minC: 23.1,
            precipitationProbabilityPct: null,
          },
        ],
      })
    } finally {
      await endpoint.close()
    }
  })

  test('credits Open-Meteo as its licence asks', ({ assert }) => {
    assert.deepEqual(new OpenMeteoProvider().attribution, {
      name: 'Open-Meteo.com',
      url: 'https://open-meteo.com/',
    })
  })

  test('a day without temperatures is left out, a missing current reading is null', async ({
    assert,
  }) => {
    const body = {
      ...FORECAST_BODY,
      current: undefined,
      daily: { ...FORECAST_BODY.daily, temperature_2m_max: [31.2, null, 28.4] },
    }
    const endpoint = await fakeOpenMeteo([json(200, body)])
    try {
      const provider = new OpenMeteoProvider({ baseUrl: endpoint.baseUrl, sleep: noWait })
      const forecast = await provider.forecast({ lat: 1, lng: 2 })

      assert.isNull(forecast.current)
      assert.deepEqual(
        forecast.daily.map((day) => day.date),
        ['2027-01-20', '2027-01-22']
      )
    } finally {
      await endpoint.close()
    }
  })

  test('retries 429 and 5xx with backoff, then answers', async ({ assert }) => {
    const waits: number[] = []
    const endpoint = await fakeOpenMeteo([
      json(503, { error: true }),
      json(429, { error: true }),
      json(200, FORECAST_BODY),
    ])
    try {
      const provider = new OpenMeteoProvider({
        baseUrl: endpoint.baseUrl,
        retryDelaysMs: [10, 20],
        sleep: async (ms) => {
          waits.push(ms)
        },
      })
      const forecast = await provider.forecast({ lat: 1, lng: 2 })

      assert.equal(endpoint.received.length, 3)
      assert.deepEqual(waits, [10, 20])
      assert.equal(forecast.timezone, 'Asia/Manila')
    } finally {
      await endpoint.close()
    }
  })

  test('gives up after its retries with WeatherUnavailableError', async ({ assert }) => {
    const endpoint = await fakeOpenMeteo([json(500, { error: true })])
    try {
      const provider = new OpenMeteoProvider({
        baseUrl: endpoint.baseUrl,
        retryDelaysMs: [1, 1],
        sleep: noWait,
      })
      await assert.rejects(() => provider.forecast({ lat: 1, lng: 2 }), WeatherUnavailableError)
      assert.equal(endpoint.received.length, 3)
    } finally {
      await endpoint.close()
    }
  })

  test('a 400 is not retried: the request itself is wrong', async ({ assert }) => {
    const endpoint = await fakeOpenMeteo([json(400, { error: true, reason: 'bad latitude' })])
    try {
      const provider = new OpenMeteoProvider({ baseUrl: endpoint.baseUrl, sleep: noWait })
      await assert.rejects(() => provider.forecast({ lat: 1, lng: 2 }), WeatherUnavailableError)
      assert.equal(endpoint.received.length, 1)
    } finally {
      await endpoint.close()
    }
  })

  test('a request that hangs past the timeout counts as unavailable', async ({ assert }) => {
    const endpoint = await fakeOpenMeteo([() => {}])
    try {
      const provider = new OpenMeteoProvider({
        baseUrl: endpoint.baseUrl,
        timeoutMs: 50,
        retryDelaysMs: [],
        sleep: noWait,
      })
      await assert.rejects(() => provider.forecast({ lat: 1, lng: 2 }), WeatherUnavailableError)
    } finally {
      await endpoint.close()
    }
  })

  test('a body without daily arrays is unavailable, not a crash', async ({ assert }) => {
    const endpoint = await fakeOpenMeteo([json(200, { timezone: 'UTC' })])
    try {
      const provider = new OpenMeteoProvider({
        baseUrl: endpoint.baseUrl,
        retryDelaysMs: [],
        sleep: noWait,
      })
      await assert.rejects(() => provider.forecast({ lat: 1, lng: 2 }), WeatherUnavailableError)
    } finally {
      await endpoint.close()
    }
  })
})
