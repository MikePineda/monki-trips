import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import { FakeWeatherProvider } from '../../../testing/fake-weather-provider'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from './db'
import { MetaStore } from './meta.store'
import { WEATHER_PROVIDER, WeatherStore, weatherKey } from './weather'

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

  it('caches the reading of the stop with the moment it was taken', async () => {
    await TestBed.inject(WeatherStore).refresh(
      'trip-1',
      { lat: 1, lng: 2 },
      '2027-01-21T05:00:00.000Z'
    )

    expect(provider.asked).toEqual([{ lat: 1, lng: 2 }])
    expect(await TestBed.inject(MetaStore).get(weatherKey('trip-1'))).toEqual({
      temperatureC: 18,
      condition: 'rain',
      updatedAt: '2027-01-21T05:00:00.000Z',
    })
  })

  it('a failing provider keeps the old reading', async () => {
    const meta = TestBed.inject(MetaStore)
    await meta.set(weatherKey('trip-1'), { temperatureC: 9, condition: 'clear', updatedAt: 'old' })
    provider.fail = true

    expect(
      await TestBed.inject(WeatherStore).refresh('trip-1', { lat: 1, lng: 2 }, 'now')
    ).toBeNull()
    expect(await meta.get(weatherKey('trip-1'))).toMatchObject({ updatedAt: 'old' })
  })

  it('the app provider has no weather until the real adapter lands', async () => {
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({ providers: provideOfflineTesting({ db }) })

    expect(await TestBed.inject(WEATHER_PROVIDER).current({ lat: 1, lng: 2 })).toBeNull()
  })
})
