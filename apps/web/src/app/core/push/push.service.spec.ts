import { TestBed } from '@angular/core/testing'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import { FakePushBrowser } from '../../../testing/fake-push-browser'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from '../offline/db'
import { MetaStore } from '../offline/meta.store'
import { InstallService } from '../pwa/install.service'
import { PUSH_BROWSER } from './push-browser'
import { META_PUSH_ENDPOINT, META_PUSH_SUBSCRIPTION, PushService } from './push.service'

describe('PushService', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes
  let browser: FakePushBrowser
  let ios = false
  let standalone = false

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    browser = new FakePushBrowser()
    ios = false
    standalone = false
    TestBed.configureTestingModule({
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(fakes),
        { provide: PUSH_BROWSER, useValue: browser },
        {
          provide: InstallService,
          useFactory: () => ({
            get ios() {
              return ios
            },
            standalone: () => standalone,
          }),
        },
      ],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  it('subscribe asks permission only after a gesture', async () => {
    const service = TestBed.inject(PushService)
    browser.gestureActive = false

    expect(await service.enable()).toBe('needs-gesture')
    expect(browser.calls).toEqual([])

    browser.gestureActive = true
    expect(await service.enable('Phone')).toBe('enabled')

    expect(browser.calls).toEqual(['requestPermission', 'subscribe'])
    expect(browser.lastServerKey).toHaveLength(65)
    expect(fakes.push.calls).toContain(`register:${browser.endpoint}`)
    expect(fakes.push.subscriptions.get(browser.endpoint)?.deviceLabel).toBe('Phone')
    const meta = TestBed.inject(MetaStore)
    expect(await meta.get(META_PUSH_SUBSCRIPTION)).toBe('sub-1')
    expect(await meta.get(META_PUSH_ENDPOINT)).toBe(browser.endpoint)
    await vi.waitFor(() => expect(service.status()).toBe('enabled'))
  })

  it('a refused prompt reports denied and the status turns blocked', async () => {
    const service = TestBed.inject(PushService)
    browser.promptAnswer = 'denied'

    expect(await service.enable()).toBe('denied')

    expect(browser.calls).toEqual(['requestPermission'])
    expect(fakes.push.calls).toEqual([])
    expect(service.status()).toBe('blocked')
  })

  it('an iOS tab is ios-install and enabling does nothing', async () => {
    ios = true
    const service = TestBed.inject(PushService)

    expect(service.status()).toBe('ios-install')
    expect(await service.enable()).toBe('unavailable')
    expect(browser.calls).toEqual([])
  })

  it('the installed iOS app can enable like any browser', () => {
    ios = true
    standalone = true

    expect(TestBed.inject(PushService).status()).toBe('off')
  })

  it('a browser without the push api is unsupported', () => {
    browser.isSupported = false

    expect(TestBed.inject(PushService).status()).toBe('unsupported')
  })

  it('a server without vapid keys reads as server-off', async () => {
    fakes.auth.appConfig = { ...fakes.auth.appConfig, pushEnabled: false, vapidPublicKey: null }
    const service = TestBed.inject(PushService)

    await service.loadConfig()

    expect(service.status()).toBe('server-off')
    expect(await service.enable()).toBe('unavailable')
  })

  it('disable unsubscribes the browser, forgets the server row and the meta', async () => {
    const service = TestBed.inject(PushService)
    await service.enable()

    await service.disable()

    expect(browser.calls).toContain('unsubscribe')
    expect(fakes.push.calls).toContain('unregister:sub-1')
    expect(fakes.push.subscriptions.size).toBe(0)
    expect(await TestBed.inject(MetaStore).get(META_PUSH_SUBSCRIPTION)).toBeUndefined()
    await vi.waitFor(() => expect(service.status()).toBe('off'))
  })

  it('an existing browser subscription is registered again instead of created twice', async () => {
    const service = TestBed.inject(PushService)
    await browser.subscribe(new Uint8Array(65))
    browser.calls.length = 0

    await service.enable()

    expect(browser.calls).toEqual(['requestPermission'])
    expect(fakes.push.subscriptions.has(browser.endpoint)).toBe(true)
  })

  it('a failed registration leaves nothing behind and surfaces the error', async () => {
    const service = TestBed.inject(PushService)
    fakes.push.failWith = new Error('offline')

    await expect(service.enable()).rejects.toThrow('offline')

    expect(await TestBed.inject(MetaStore).get(META_PUSH_SUBSCRIPTION)).toBeUndefined()
    expect(service.busy()).toBe(false)
  })
})
