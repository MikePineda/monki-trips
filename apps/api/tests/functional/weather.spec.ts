import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import type User from '#models/user'
import { FakeWeatherProvider } from '#services/weather/fake_weather_provider'
import { OffWeatherProvider } from '#services/weather/off_weather_provider'
import { WeatherProvider } from '#services/weather/weather_provider'
import { actingAs } from '#tests/helpers/acting_as'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { makeTrip } from '#tests/helpers/make_trip'
import { makeUser } from '#tests/helpers/make_user'
import { mutation, pushApplied } from '#tests/helpers/sync'

/** Synthetic coordinates of an invented harbour town. */
const HARBOUR = { lat: 10.123456, lng: 120.654321 }

async function tripWithStop(client: ApiClient, owner: User, place = HARBOUR) {
  const trip = await makeTrip(owner, { startsOn: '2027-01-20', endsOn: '2027-01-29' })
  const stop = await pushApplied<{ id: string }>(
    client,
    owner,
    mutation(trip.id, 'stop', {
      name: 'Port Vellmar',
      tz: 'Asia/Bangkok',
      arriveOn: '2027-01-20',
      departOn: '2027-01-24',
      ...place,
    })
  )
  return { trip, stopId: stop.id }
}

function weatherOf(client: ApiClient, owner: User, tripId: string, date: string) {
  return actingAs(client.get(`/api/v1/trips/${tripId}/weather?date=${date}`), owner)
}

test.group('Weather', (group) => {
  const clock = useFixedClock(group, new Date('2027-01-21T05:00:00Z'))
  let provider: FakeWeatherProvider

  group.each.setup(() => {
    provider = new FakeWeatherProvider(() => clock.now())
    app.container.swap(WeatherProvider, () => provider)
    return () => app.container.restore(WeatherProvider)
  })

  test('answers the stop of that local date: current, three days, fetchedAt and attribution', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const { trip, stopId } = await tripWithStop(client, owner)

    const response = await weatherOf(client, owner, trip.id, '2027-01-21')

    response.assertStatus(200)
    const weather = response.body().data
    assert.deepEqual(weather.place, { stopId, name: 'Port Vellmar' })
    assert.equal(weather.date, '2027-01-21')
    assert.deepEqual(weather.current, {
      temperatureC: 21.4,
      condition: 'partly_cloudy',
      precipitationMm: 0.2,
    })
    assert.deepEqual(
      weather.daily.map((day: { date: string }) => day.date),
      ['2027-01-21', '2027-01-22', '2027-01-23']
    )
    assert.deepInclude(weather.daily[0], {
      condition: 'rain',
      maxC: 24,
      minC: 16,
      precipitationProbabilityPct: 40,
    })
    assert.equal(weather.fetchedAt, '2027-01-21T05:00:00.000Z')
    assert.deepEqual(weather.attribution, provider.attribution)
  })

  test('only rounded coordinates reach the provider and the shared cache', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)

    await weatherOf(client, owner, trip.id, '2027-01-21')

    assert.deepEqual(provider.calls, [{ lat: 10.12, lng: 120.65 }])
    const rows = await db.from('weather_snapshots').select('*')
    assert.lengthOf(rows, 1)
    assert.sameMembers(Object.keys(rows[0]), ['lat', 'lng', 'fetched_at', 'payload'])
    assert.equal(Number(rows[0].lat), 10.12)
    assert.equal(Number(rows[0].lng), 120.65)
  })

  test('a later day starts its three days there and has no current reading', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)

    const response = await weatherOf(client, owner, trip.id, '2027-01-23')

    response.assertStatus(200)
    assert.isNull(response.body().data.current)
    assert.equal(response.body().data.daily[0].date, '2027-01-23')
  })

  test('within 30 minutes the cache answers, shared by another trip at the same place', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const other = await makeUser()
    const { trip } = await tripWithStop(client, owner)
    const { trip: otherTrip } = await tripWithStop(client, other, { lat: 10.1249, lng: 120.6501 })

    await weatherOf(client, owner, trip.id, '2027-01-21')
    clock.advance(29 * 60 * 1000)
    const again = await weatherOf(client, other, otherTrip.id, '2027-01-22')

    again.assertStatus(200)
    assert.lengthOf(provider.calls, 1)
    assert.equal(again.body().data.fetchedAt, '2027-01-21T05:00:00.000Z')
  })

  test('after 30 minutes the provider is asked again and the snapshot replaced', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)

    await weatherOf(client, owner, trip.id, '2027-01-21')
    clock.advance(30 * 60 * 1000)
    const again = await weatherOf(client, owner, trip.id, '2027-01-21')

    assert.lengthOf(provider.calls, 2)
    assert.equal(again.body().data.fetchedAt, '2027-01-21T05:30:00.000Z')
  })

  test('without a placed stop it reads the coordinates of that night lodging', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner, { startsOn: '2027-01-20', endsOn: '2027-01-29' })
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'stop', {
        name: 'Port Vellmar',
        tz: 'Asia/Bangkok',
        arriveOn: '2027-01-20',
        departOn: '2027-01-24',
      })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'lodging',
        title: 'Harbour Inn',
        status: 'booked',
        startsLocal: '2027-01-20T15:00',
        startTz: 'Asia/Bangkok',
        endsLocal: '2027-01-22T11:00',
        endTz: 'Asia/Bangkok',
        lat: -33.871,
        lng: 151.2,
      })
    )

    const response = await weatherOf(client, owner, trip.id, '2027-01-21')

    response.assertStatus(200)
    assert.deepEqual(response.body().data.place, { stopId: null, name: 'Harbour Inn' })
    assert.deepEqual(provider.calls, [{ lat: -33.87, lng: 151.2 }])
  })

  test('a day with no known place, or beyond the forecast, answers null', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)

    const noPlace = await weatherOf(client, owner, trip.id, '2027-01-27')
    noPlace.assertStatus(200)
    assert.isNull(noPlace.body().data)
    assert.lengthOf(provider.calls, 0)

    const far = await makeTrip(owner, { startsOn: '2027-03-01', endsOn: '2027-03-05' })
    await pushApplied(
      client,
      owner,
      mutation(far.id, 'stop', {
        name: 'Saltmere',
        tz: 'Asia/Bangkok',
        arriveOn: '2027-03-01',
        departOn: '2027-03-05',
        ...HARBOUR,
      })
    )
    const beyond = await weatherOf(client, owner, far.id, '2027-03-02')
    beyond.assertStatus(200)
    assert.isNull(beyond.body().data)
  })

  test('an outage with nothing cached answers 503 E_WEATHER_UNAVAILABLE', async ({ client }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)
    provider.unavailable = true

    const response = await weatherOf(client, owner, trip.id, '2027-01-21')

    response.assertStatus(503)
    response.assertBodyContains({ code: 'E_WEATHER_UNAVAILABLE' })
  })

  test('an outage with an old snapshot answers it with its own age', async ({ client, assert }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)
    await weatherOf(client, owner, trip.id, '2027-01-21')
    clock.advance(3 * 60 * 60 * 1000)
    provider.unavailable = true

    const response = await weatherOf(client, owner, trip.id, '2027-01-21')

    response.assertStatus(200)
    assert.equal(response.body().data.fetchedAt, '2027-01-21T05:00:00.000Z')
  })

  test('weather switched off answers null without a provider call', async ({ client, assert }) => {
    app.container.swap(WeatherProvider, () => new OffWeatherProvider())
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)

    const response = await weatherOf(client, owner, trip.id, '2027-01-21')

    response.assertStatus(200)
    assert.isNull(response.body().data)
  })

  test('a trip you are not a member of answers 404, never 403', async ({ client, assert }) => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const { trip } = await tripWithStop(client, owner)

    const response = await weatherOf(client, stranger, trip.id, '2027-01-21')

    response.assertStatus(404)
    assert.lengthOf(provider.calls, 0)
  })

  test('the date is required and must be a calendar date', async ({ client }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)

    const missing = await actingAs(client.get(`/api/v1/trips/${trip.id}/weather`), owner)
    missing.assertStatus(422)
    const invalid = await weatherOf(client, owner, trip.id, '2027-02-30')
    invalid.assertStatus(422)
  })

  test('signed out is 401', async ({ client }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)

    const response = await client.get(`/api/v1/trips/${trip.id}/weather?date=2027-01-21`)

    response.assertStatus(401)
  })

  test('lookups are throttled per account: the 121st within the hour is 429', async ({
    client,
  }) => {
    const owner = await makeUser()
    const { trip } = await tripWithStop(client, owner)
    for (let index = 0; index < 120; index += 1) {
      const response = await weatherOf(client, owner, trip.id, '2027-01-21')
      response.assertStatus(200)
    }

    const blocked = await weatherOf(client, owner, trip.id, '2027-01-21')

    blocked.assertStatus(429)
  }).timeout(60_000)
})
