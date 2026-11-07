import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from '../offline/db'
import { META_LAST_OFFLINE_BOOT_AT, MetaStore } from '../offline/meta.store'
import { OfflineBootRecorder } from './offline-boot'

describe('OfflineBootRecorder', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      providers: provideOfflineTesting({ db, clock: new TestClock('2027-01-08T06:30:00.000Z') }),
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  it('offline cold boot records the rehearsal date', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    expect(await TestBed.inject(OfflineBootRecorder).record()).toBe(true)

    expect(await TestBed.inject(MetaStore).get(META_LAST_OFFLINE_BOOT_AT)).toBe(
      '2027-01-08T06:30:00.000Z'
    )
  })

  it('a start with network records nothing', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    expect(await TestBed.inject(OfflineBootRecorder).record()).toBe(false)

    expect(await TestBed.inject(MetaStore).get(META_LAST_OFFLINE_BOOT_AT)).toBeUndefined()
  })
})
