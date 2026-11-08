import { TestBed } from '@angular/core/testing'
import { ScreenWakeLock } from './screen-wake-lock'

function fakeWakeLock() {
  const sentinels: { released: boolean; release: () => Promise<void> }[] = []
  const wakeLock = {
    request: vi.fn(async () => {
      const sentinel = {
        released: false,
        release: async () => {
          sentinel.released = true
        },
      }
      sentinels.push(sentinel)
      return sentinel
    }),
  }
  return { wakeLock, sentinels }
}

describe('ScreenWakeLock', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('keeps the screen on while held and lets it go on release', async () => {
    const { wakeLock, sentinels } = fakeWakeLock()
    Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true })
    const lock = TestBed.inject(ScreenWakeLock)

    await lock.hold()
    expect(lock.supported).toBe(true)
    expect(wakeLock.request).toHaveBeenCalledWith('screen')

    await lock.release()
    expect(sentinels[0]?.released).toBe(true)
  })

  it('takes the lock again when the page comes back while still held', async () => {
    const { wakeLock, sentinels } = fakeWakeLock()
    Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true })
    const lock = TestBed.inject(ScreenWakeLock)
    await lock.hold()
    sentinels[0]!.released = true

    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(wakeLock.request).toHaveBeenCalledTimes(2))
    await lock.release()
  })

  it('does nothing where the browser has no Wake Lock', async () => {
    const lock = TestBed.inject(ScreenWakeLock)

    expect(lock.supported).toBe(false)
    await expect(lock.hold()).resolves.toBeUndefined()
    await expect(lock.release()).resolves.toBeUndefined()
  })
})
