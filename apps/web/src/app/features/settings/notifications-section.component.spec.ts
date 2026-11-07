import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import { FakePushBrowser } from '../../../testing/fake-push-browser'
import { SCOPE_CATALOGUES } from '../../../testing/i18n-scopes'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import { ApiFailure } from '../../core/api/api-failure'
import type { MonkiTripsDb } from '../../core/offline/db'
import { MetaStore } from '../../core/offline/meta.store'
import { PUSH_BROWSER } from '../../core/push/push-browser'
import { META_PUSH_SUBSCRIPTION } from '../../core/push/push.service'
import { InstallService } from '../../core/pwa/install.service'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { NotificationsSectionComponent } from './notifications-section.component'

const copy = SCOPE_CATALOGUES.settings.en

describe('NotificationsSectionComponent', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes
  let browser: FakePushBrowser
  let ios: boolean
  let standalone: boolean

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    browser = new FakePushBrowser()
    ios = false
    standalone = false
    TestBed.configureTestingModule({
      imports: [NotificationsSectionComponent, i18nTesting()],
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
    TestBed.inject(Dialog).closeAll()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(NotificationsSectionComponent)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      section: () => host.querySelector<HTMLElement>('[data-testid="settings.notifications"]')!,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
    }
  }

  it('iOS browser tab shows install instructions instead of the toggle', async () => {
    ios = true
    const { section, has, click } = await render()

    expect(section().getAttribute('data-status')).toBe('ios-install')
    expect(has('settings.notifications.toggle')).toBe(false)
    expect(section().textContent).toContain(copy.notifications.iosInstall)

    await click('settings.notifications.install')
    TestBed.tick()

    expect(
      document.querySelector('.cdk-overlay-container [data-testid="settings.install.ios"]')
    ).not.toBeNull()
  })

  it('the toggle registers this device with its name and the section reads enabled', async () => {
    const { fixture, host, section, click, has } = await render()
    expect(section().getAttribute('data-status')).toBe('off')

    typeInto(
      host.querySelector<HTMLInputElement>('[data-testid="settings.notifications.deviceLabel"]')!,
      'Phone'
    )
    await settle(fixture)
    await click('settings.notifications.toggle')

    expect(browser.calls).toEqual(['requestPermission', 'subscribe'])
    expect(fakes.push.subscriptions.get(browser.endpoint)?.deviceLabel).toBe('Phone')
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(section().getAttribute('data-status')).toBe('enabled')
    })
    expect(
      host
        .querySelector('[data-testid="settings.notifications.toggle"]')
        ?.getAttribute('aria-checked')
    ).toBe('true')
    expect(has('settings.notifications.test')).toBe(true)
  })

  it('a refused prompt leaves the switch off and explains the block', async () => {
    browser.promptAnswer = 'denied'
    const { section, click, has } = await render()

    await click('settings.notifications.toggle')

    expect(section().getAttribute('data-status')).toBe('blocked')
    expect(has('settings.notifications.toggle')).toBe(false)
    expect(section().textContent).toContain(copy.notifications.blocked)
  })

  it('test push button reports the api error', async () => {
    browser.currentPermission = 'granted'
    await TestBed.inject(MetaStore).set(META_PUSH_SUBSCRIPTION, 'sub-1')
    const { fixture, section, click, text } = await render()
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(section().getAttribute('data-status')).toBe('enabled')
    })
    fakes.push.failWith = new ApiFailure({
      kind: 'http',
      status: 409,
      code: 'E_PUSH_DISABLED',
      message: 'server says no',
    })

    await click('settings.notifications.test')

    expect(text('settings.notifications.error')).toBe(copy.errors.E_PUSH_DISABLED)
    expect(TestBed.inject(ToastService).toasts()).toEqual([])
  })

  it('a sent test confirms in a toast', async () => {
    browser.currentPermission = 'granted'
    await TestBed.inject(MetaStore).set(META_PUSH_SUBSCRIPTION, 'sub-1')
    const { fixture, section, click } = await render()
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(section().getAttribute('data-status')).toBe('enabled')
    })

    await click('settings.notifications.test')

    expect(fakes.push.calls).toContain('sendTest')
    expect(TestBed.inject(ToastService).toasts()[0]?.message).toBe(copy.notifications.testSent)
  })

  it('switching off unsubscribes and shows the name field again', async () => {
    const { fixture, section, click, has } = await render()
    await click('settings.notifications.toggle')
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(section().getAttribute('data-status')).toBe('enabled')
    })

    await click('settings.notifications.toggle')

    expect(browser.calls).toContain('unsubscribe')
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(section().getAttribute('data-status')).toBe('off')
    })
    expect(has('settings.notifications.deviceLabel')).toBe(true)
  })

  it('a server without keys says so instead of offering the switch', async () => {
    fakes.auth.appConfig = { ...fakes.auth.appConfig, pushEnabled: false, vapidPublicKey: null }
    const { fixture, section, has } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(section().getAttribute('data-status')).toBe('server-off')
    })
    expect(has('settings.notifications.toggle')).toBe(false)
  })
})
