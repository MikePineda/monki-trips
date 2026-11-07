import { TestBed } from '@angular/core/testing'
import { InstallService, type BeforeInstallPromptEvent } from './install.service'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile'

describe('InstallService', () => {
  function stubDevice({
    userAgent,
    standalone = false,
  }: {
    userAgent: string
    standalone?: boolean
  }) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('standalone') && standalone,
      media: query,
    }))
  }

  function fakePromptEvent(outcome: 'accepted' | 'dismissed'): BeforeInstallPromptEvent {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent
    Object.assign(event, {
      prompt: vi.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome }),
    })
    return event
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('on Android it waits for beforeinstallprompt, then can prompt', async () => {
    stubDevice({ userAgent: ANDROID })
    const service = TestBed.inject(InstallService)
    expect(service.mode()).toBe('unavailable')

    const event = fakePromptEvent('accepted')
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(service.mode()).toBe('prompt')
    expect(await service.prompt()).toBe('accepted')
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(service.mode()).toBe('unavailable')
  })

  it('a dismissed prompt can be offered again', async () => {
    stubDevice({ userAgent: ANDROID })
    const service = TestBed.inject(InstallService)
    window.dispatchEvent(fakePromptEvent('dismissed'))

    expect(await service.prompt()).toBe('dismissed')
    expect(service.mode()).toBe('prompt')
  })

  it('on iOS it offers the instructions sheet instead', () => {
    stubDevice({ userAgent: IPHONE })

    expect(TestBed.inject(InstallService).mode()).toBe('ios-instructions')
  })

  it('an installed app (standalone) has nothing to offer', () => {
    stubDevice({ userAgent: IPHONE, standalone: true })

    expect(TestBed.inject(InstallService).mode()).toBe('installed')
  })

  it('appinstalled flips to installed', () => {
    stubDevice({ userAgent: ANDROID })
    const service = TestBed.inject(InstallService)

    window.dispatchEvent(new Event('appinstalled'))

    expect(service.mode()).toBe('installed')
  })

  it('prompting with nothing deferred is a no-op', async () => {
    stubDevice({ userAgent: ANDROID })

    expect(await TestBed.inject(InstallService).prompt()).toBe('unavailable')
  })
})
