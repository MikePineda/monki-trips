import { TestBed } from '@angular/core/testing'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import { FAKE_APP_CONFIG } from '../../../testing/fake-auth-api'
import { AppConfigStore } from './app-config.store'

describe('AppConfigStore', () => {
  let fakes: ApiFakes

  beforeEach(() => {
    fakes = apiFakes()
    TestBed.configureTestingModule({ providers: [...provideApiTesting(fakes)] })
  })

  afterEach(() => TestBed.resetTestingModule())

  it('vision reads as available until the server says otherwise', async () => {
    fakes.auth.appConfig = { ...FAKE_APP_CONFIG, visionEnabled: false }
    const store = TestBed.inject(AppConfigStore)

    expect(store.visionEnabled()).toBe(true)
    await store.load()

    expect(store.visionEnabled()).toBe(false)
  })

  it('reads the config once and tries again after a failure', async () => {
    fakes.auth.failWith = new TypeError('Failed to fetch')
    const store = TestBed.inject(AppConfigStore)

    await store.load()
    expect(store.visionEnabled()).toBe(true)
    await store.load()
    await store.load()

    expect(fakes.auth.calls).toEqual(['config', 'config'])
  })
})
