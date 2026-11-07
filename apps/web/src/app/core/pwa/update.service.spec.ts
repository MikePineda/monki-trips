import { DOCUMENT } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { SwUpdate, type UnrecoverableStateEvent, type VersionEvent } from '@angular/service-worker'
import { Subject } from 'rxjs'
import { i18nTesting } from '../../../testing/i18n-testing'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { UpdateService } from './update.service'

describe('UpdateService', () => {
  const versionUpdates = new Subject<VersionEvent>()
  const unrecoverable = new Subject<UnrecoverableStateEvent>()
  const checkForUpdate = vi.fn(async () => false)
  let enabled = true

  const fakeSwUpdate = {
    get isEnabled() {
      return enabled
    },
    versionUpdates,
    unrecoverable,
    checkForUpdate,
  }

  const reload = vi.fn()

  beforeEach(() => {
    enabled = true
    checkForUpdate.mockClear()
    reload.mockClear()
    TestBed.configureTestingModule({
      imports: [i18nTesting()],
      providers: [
        { provide: SwUpdate, useValue: fakeSwUpdate },
        {
          provide: DOCUMENT,
          useFactory: () => {
            // The real document, with a location whose reload we can observe.
            const view = { location: { reload } }
            return new Proxy(document, {
              get: (target, property) => {
                if (property === 'defaultView') {
                  return view
                }
                const value = Reflect.get(target, property)
                return typeof value === 'function' ? value.bind(target) : value
              },
            })
          },
        },
      ],
    })
  })

  function ready(): VersionEvent {
    return {
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    }
  }

  it('a ready version shows one persistent toast and never reloads by itself', () => {
    const service = TestBed.inject(UpdateService)
    const toasts = TestBed.inject(ToastService)
    service.start()

    versionUpdates.next(ready())
    versionUpdates.next(ready())

    expect(toasts.toasts()).toHaveLength(1)
    expect(toasts.toasts()[0]).toMatchObject({
      message: 'A new version is ready',
      persistent: true,
    })
    expect(toasts.toasts()[0].action?.label).toBe('Reload')
    expect(reload).not.toHaveBeenCalled()
  })

  it('the toast action reloads', () => {
    TestBed.inject(UpdateService).start()
    const toasts = TestBed.inject(ToastService)
    versionUpdates.next(ready())

    toasts.act(toasts.toasts()[0].id)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('checks for an update when the app comes back to the foreground', () => {
    TestBed.inject(UpdateService).start()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(checkForUpdate).toHaveBeenCalledTimes(1)
  })

  it('an unrecoverable state is flagged for the shell banner', () => {
    const service = TestBed.inject(UpdateService)
    service.start()

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' })

    expect(service.unrecoverable()).toBe(true)
  })

  it('does nothing when the service worker is disabled (dev server)', () => {
    enabled = false
    TestBed.inject(UpdateService).start()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(checkForUpdate).not.toHaveBeenCalled()
  })
})
