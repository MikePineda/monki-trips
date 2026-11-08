import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WEATHER_CONDITIONS, weatherCondition } from './weather_condition.ts'

test('the enum is the eight conditions Today can draw', () => {
  assert.deepEqual(WEATHER_CONDITIONS, [
    'clear',
    'partly_cloudy',
    'cloudy',
    'fog',
    'drizzle',
    'rain',
    'thunderstorm',
    'snow',
  ])
})

test('clear and mainly clear skies are clear, partly cloudy and overcast keep their names', () => {
  assert.equal(weatherCondition(0), 'clear')
  assert.equal(weatherCondition(1), 'clear')
  assert.equal(weatherCondition(2), 'partly_cloudy')
  assert.equal(weatherCondition(3), 'cloudy')
})

test('fog and rime fog are fog', () => {
  assert.equal(weatherCondition(45), 'fog')
  assert.equal(weatherCondition(48), 'fog')
})

test('drizzle, freezing drizzle included, is drizzle', () => {
  for (const code of [51, 53, 55, 56, 57]) assert.equal(weatherCondition(code), 'drizzle')
})

test('rain, freezing rain and rain showers are rain', () => {
  for (const code of [61, 63, 65, 66, 67, 80, 81, 82]) assert.equal(weatherCondition(code), 'rain')
})

test('snowfall, snow grains and snow showers are snow', () => {
  for (const code of [71, 73, 75, 77, 85, 86]) assert.equal(weatherCondition(code), 'snow')
})

test('thunderstorms with or without hail are thunderstorm', () => {
  for (const code of [95, 96, 99]) assert.equal(weatherCondition(code), 'thunderstorm')
})

test('an unknown code reads as cloudy rather than inventing sunshine', () => {
  assert.equal(weatherCondition(4), 'cloudy')
  assert.equal(weatherCondition(-1), 'cloudy')
  assert.equal(weatherCondition(Number.NaN), 'cloudy')
})
