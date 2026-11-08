import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import { FakeWeatherProvider } from '../../../testing/fake-weather-provider'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { tripWeatherFixture } from '../../../testing/weather-fixtures'
import type { MonkiTripsDb } from './db'
import { MetaStore } from './meta.store'
import { WEATHER_PROVIDER, WeatherStore, forecastDates, weatherKey } from './weather'

describe('WeatherStore', () => {
  let db: MonkiTripsDb
  let provider: FakeWeatherProvider

  beforeEach(() => {
    db = freshOfflineDb()
    provider = new FakeWeatherProvider()
    TestBed.configureTestingModule({
      providers: [
        ...provideOfflineTesting({ db }),
        { provide: WEATHER_PROVIDER, useValue: provider },
      ],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  it('keys the cache by trip and day', () => {
    expect(weatherKey('trip-1', '2027-01-21')).toBe('weather.trip-1.2027-01-21')
  })

  it('caches the answer of a day with the moment the server read it as its age', async () => {
    const stored = await TestBed.inject(WeatherStore).refresh('trip-1', '2027-01-21')

    expect(provider.asked).toEqual([{ tripId: 'trip-1', date: '2027-01-21' }])
    const cached = await TestBed.inject(MetaStore).get(weatherKey('trip-1', '2027-01-21'))
    expect(cached).toEqual(stored)
    expect(cached).toMatchObject({
      date: '2027-01-21',
      updatedAt: '2027-01-21T02:00:00.000Z',
      fetchedAt: '2027-01-21T02:00:00.000Z',
    })
  })

  it('a failing provider or a day without weather keeps the old copy', async () => {
    const meta = TestBed.inject(MetaStore)
    const key = weatherKey('trip-1', '2027-01-21')
    await meta.set(key, { ...tripWeatherFixture(), updatedAt: 'old' })
    const store = TestBed.inject(WeatherStore)

    provider.fail = true
    expect(await store.refresh('trip-1', '2027-01-21')).toBeNull()
    provider.fail = false
    provider.answer = () => null
    expect(await store.refresh('trip-1', '2027-01-21')).toBeNull()

    expect(await meta.get(key)).toMatchObject({ updatedAt: 'old' })
  })

  it('saves every day asked for and counts the ones that failed', async () => {
    let calls = 0
    provider.answer = (date) => {
      calls += 1
      if (calls === 2) {
        throw new Error('flaky')
      }
      return tripWeatherFixture({ date })
    }

    const result = await TestBed.inject(WeatherStore).refreshDays('trip-1', [
      '2027-01-21',
      '2027-01-22',
      '2027-01-23',
    ])

    expect(result).toEqual({ saved: 2, failed: 1 })
    const meta = TestBed.inject(MetaStore)
    expect(await meta.get(weatherKey('trip-1', '2027-01-21'))).toBeDefined()
    expect(await meta.get(weatherKey('trip-1', '2027-01-22'))).toBeUndefined()
    expect(await meta.get(weatherKey('trip-1', '2027-01-23'))).toBeDefined()
  })
})

describe('forecastDates', () => {
  it('lists the trip days from today, at most sixteen', () => {
    expect(forecastDates({ startsOn: '2027-01-20', endsOn: '2027-01-24' }, '2027-01-22')).toEqual([
      '2027-01-22',
      '2027-01-23',
      '2027-01-24',
    ])
    expect(forecastDates({ startsOn: '2027-01-01', endsOn: '2027-03-01' }, '2026-12-25')).toEqual(
      expect.arrayContaining(['2027-01-01', '2027-01-09'])
    )
    expect(
      forecastDates({ startsOn: '2027-01-01', endsOn: '2027-03-01' }, '2026-12-25')
    ).toHaveLength(9)
    expect(
      forecastDates({ startsOn: '2027-01-01', endsOn: '2027-03-01' }, '2027-01-10')
    ).toHaveLength(16)
  })

  it('a trip that is over or more than sixteen days away has no forecast days', () => {
    expect(forecastDates({ startsOn: '2027-01-01', endsOn: '2027-01-05' }, '2027-01-06')).toEqual(
      []
    )
    expect(forecastDates({ startsOn: '2030-03-01', endsOn: '2030-03-05' }, '2027-01-06')).toEqual(
      []
    )
  })
})
