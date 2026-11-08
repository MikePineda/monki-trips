import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forecastOn, type WeatherDay, type WeatherForecast } from './weather_forecast.ts'

function day(date: string, maxC = 24): WeatherDay {
  return { date, condition: 'rain', maxC, minC: 16, precipitationProbabilityPct: 40 }
}

const FORECAST: WeatherForecast = {
  timezone: 'Asia/Bangkok',
  current: { temperatureC: 21.4, condition: 'cloudy', precipitationMm: 0.2 },
  daily: [day('2027-01-20'), day('2027-01-21', 25), day('2027-01-22', 26), day('2027-01-23', 27)],
}

test('the forecast of the first day carries the current conditions and three days', () => {
  assert.deepEqual(forecastOn(FORECAST, '2027-01-20'), {
    current: FORECAST.current,
    daily: FORECAST.daily.slice(0, 3),
  })
})

test('a later day starts the three days on that date and has no current conditions', () => {
  const later = forecastOn(FORECAST, '2027-01-22')
  assert.equal(later?.current, null)
  assert.deepEqual(
    later?.daily.map((d) => d.date),
    ['2027-01-22', '2027-01-23']
  )
})

test('a date outside the forecast has no weather', () => {
  assert.equal(forecastOn(FORECAST, '2027-01-19'), null)
  assert.equal(forecastOn(FORECAST, '2027-02-01'), null)
})
