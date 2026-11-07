import { TestBed } from '@angular/core/testing'
import type { HealthReport } from '@monkitrips/shared'
import {
  TEST_NOW,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { HEALTH_API, type HealthApi } from '../api/health-api'
import type { MonkiTripsDb } from '../offline/db'
import { META_APP_VERSION, MetaStore } from '../offline/meta.store'
import { AppVersionStore } from './app-version.store'

describe('AppVersionStore', () => {
  let db: MonkiTripsDb
  let report: HealthReport | Error

  const api: HealthApi = {
    async health() {
      if (report instanceof Error) {
        throw report
      }
      return report
    },
  }

  beforeEach(() => {
    db = freshOfflineDb()
    report = { status: 'ok', version: '0.1.0', sha: 'abc1234', checks: { db: { status: 'ok' } } }
    TestBed.configureTestingModule({
      providers: [...provideOfflineTesting({ db }), { provide: HEALTH_API, useValue: api }],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  it('caches the version and sha from /api/health in meta', async () => {
    const store = TestBed.inject(AppVersionStore)

    const info = await store.refresh()

    expect(info).toEqual({ version: '0.1.0', sha: 'abc1234', fetchedAt: TEST_NOW })
    expect(await TestBed.inject(MetaStore).get(META_APP_VERSION)).toEqual(info)
    await vi.waitFor(() => expect(store.info()?.version).toBe('0.1.0'))
  })

  it('keeps the cached build when the probe fails (offline)', async () => {
    const cached = { version: '0.0.9', sha: 'old', fetchedAt: '2026-11-01T00:00:00.000Z' }
    await TestBed.inject(MetaStore).set(META_APP_VERSION, cached)
    report = new TypeError('fetch failed')

    expect(await TestBed.inject(AppVersionStore).refresh()).toEqual(cached)
  })
})
