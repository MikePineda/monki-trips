import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  roundCoordinate,
  weatherPlaceOn,
  type WeatherPlaceEvent,
  type WeatherPlaceStop,
} from './weather_place.ts'

function stop(overrides: Partial<WeatherPlaceStop> = {}): WeatherPlaceStop {
  return {
    id: 'stop-a',
    position: 0,
    name: 'Port Vellmar',
    lat: 10.123456,
    lng: 120.654321,
    arriveOn: '2027-01-20',
    departOn: '2027-01-23',
    deletedAt: null,
    ...overrides,
  }
}

function lodging(overrides: Partial<WeatherPlaceEvent> = {}): WeatherPlaceEvent {
  return {
    id: 'inn',
    kind: 'lodging',
    status: 'booked',
    title: 'Harbour Inn',
    placeName: null,
    startsOn: '2027-01-20',
    endsLocal: '2027-01-22T11:00:00',
    lat: 11.5,
    lng: 121.25,
    deletedAt: null,
    ...overrides,
  }
}

test('the stop covering the local date gives the place, with its coordinates', () => {
  assert.deepEqual(weatherPlaceOn('2027-01-21', [stop()], []), {
    stopId: 'stop-a',
    name: 'Port Vellmar',
    lat: 10.123456,
    lng: 120.654321,
  })
})

test('stop resolution reads the local date inclusively on both ends', () => {
  assert.equal(weatherPlaceOn('2027-01-20', [stop()], [])?.stopId, 'stop-a')
  assert.equal(weatherPlaceOn('2027-01-23', [stop()], [])?.stopId, 'stop-a')
  assert.equal(weatherPlaceOn('2027-01-24', [stop()], []), null)
})

test('on a travel day the stop you arrive at wins: that is where you will be', () => {
  const stops = [
    stop({
      id: 'stop-b',
      position: 1,
      name: 'Saltmere',
      arriveOn: '2027-01-23',
      departOn: '2027-01-25',
    }),
    stop(),
  ]
  assert.equal(weatherPlaceOn('2027-01-23', stops, [])?.stopId, 'stop-b')
})

test('stops without coordinates or deleted ones are skipped', () => {
  const stops = [
    stop({ id: 'stop-b', position: 1, lat: null, arriveOn: '2027-01-21' }),
    stop({ id: 'stop-c', position: 2, deletedAt: '2027-01-01T00:00:00.000Z' }),
    stop(),
  ]
  assert.equal(weatherPlaceOn('2027-01-21', stops, [])?.stopId, 'stop-a')
})

test('without a placed stop it falls back to the lodging of that night', () => {
  const place = weatherPlaceOn('2027-01-21', [stop({ lat: null, lng: null })], [lodging()])
  assert.deepEqual(place, { stopId: null, name: 'Harbour Inn', lat: 11.5, lng: 121.25 })
})

test('the lodging counts from its first night to its checkout day', () => {
  assert.equal(weatherPlaceOn('2027-01-20', [], [lodging()])?.name, 'Harbour Inn')
  assert.equal(weatherPlaceOn('2027-01-22', [], [lodging()])?.name, 'Harbour Inn')
  assert.equal(weatherPlaceOn('2027-01-23', [], [lodging()]), null)
  assert.equal(weatherPlaceOn('2027-01-19', [], [lodging()]), null)
})

test('cancelled, deleted, unplaced or non-lodging events give no place', () => {
  const events = [
    lodging({ status: 'cancelled' }),
    lodging({ deletedAt: '2027-01-01T00:00:00.000Z' }),
    lodging({ lat: null }),
    lodging({ kind: 'tour' }),
  ]
  assert.equal(weatherPlaceOn('2027-01-21', [], events), null)
})

test('the lodging place name is preferred over its title', () => {
  assert.equal(
    weatherPlaceOn('2027-01-21', [], [lodging({ placeName: 'Old Town' })])?.name,
    'Old Town'
  )
})

test('coordinates round to two decimals for the shared cache, about a kilometre', () => {
  assert.equal(roundCoordinate(10.123456), 10.12)
  assert.equal(roundCoordinate(-33.875), -33.88)
  assert.equal(roundCoordinate(120.005), 120.01)
  assert.equal(roundCoordinate(0), 0)
})
