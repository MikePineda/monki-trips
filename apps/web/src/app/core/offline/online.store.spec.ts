import { TestBed } from '@angular/core/testing'
import { OnlineStore } from './online.store'

describe('OnlineStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts from what the browser reports', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    expect(TestBed.inject(OnlineStore).online()).toBe(false)
  })

  it('follows the offline and online events', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const store = TestBed.inject(OnlineStore)

    window.dispatchEvent(new Event('offline'))
    expect(store.online()).toBe(false)

    window.dispatchEvent(new Event('online'))
    expect(store.online()).toBe(true)
  })

  it('stops listening once the app is destroyed', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const store = TestBed.inject(OnlineStore)

    TestBed.resetTestingModule()
    window.dispatchEvent(new Event('offline'))

    expect(store.online()).toBe(true)
  })
})
