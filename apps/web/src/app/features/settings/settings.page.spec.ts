import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { RouterTestingHarness } from '@angular/router/testing'
import type { HealthReport } from '@monkitrips/shared'
import { settingsRoute } from '../../app.routes'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { provideApiTesting } from '../../../testing/api-testing'
import { HEALTH_API } from '../../core/api/health-api'
import { LANG_STORAGE_KEY } from '../../core/i18n/lang.store'
import type { MonkiTripsDb } from '../../core/offline/db'
import { InstallService, type InstallMode } from '../../core/pwa/install.service'
import { SessionStore } from '../../core/session/session.store'
import { THEME_STORAGE_KEY } from '../../core/theme/theme.store'
import SettingsPage from './settings.page'

describe('SettingsPage', () => {
  let db: MonkiTripsDb
  let installMode: InstallMode
  const report: HealthReport = {
    status: 'ok',
    version: '0.1.0',
    sha: 'abc1234',
    checks: { db: { status: 'ok' } },
  }

  beforeEach(() => {
    db = freshOfflineDb()
    installMode = 'unavailable'
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    TestBed.configureTestingModule({
      imports: [SettingsPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(),
        provideRouter([settingsRoute('settings')]),
        { provide: HEALTH_API, useValue: { health: async () => report } },
      ],
    })
    vi.spyOn(TestBed.inject(InstallService), 'mode').mockImplementation(() => installMode)
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    await resetOfflineTesting(db)
    document.documentElement.removeAttribute('data-theme')
  })

  function render() {
    const fixture = TestBed.createComponent(SettingsPage)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      click: (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click(),
    }
  }

  it('switching the language re-renders and remembers the choice', () => {
    const { fixture, host, click } = render()
    expect(host.querySelector('h1')?.textContent).toBe('Settings')

    click('settings.lang.es')
    fixture.detectChanges()

    expect(host.querySelector('h1')?.textContent).toBe('Ajustes')
    expect(
      host.querySelector('[data-testid="settings.lang.es"]')?.getAttribute('aria-checked')
    ).toBe('true')
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('es')
  })

  it('choosing a theme flips data-theme and remembers it', () => {
    const { fixture, host, click } = render()

    click('settings.theme.dark')
    fixture.detectChanges()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(
      host.querySelector('[data-testid="settings.theme.dark"]')?.getAttribute('aria-checked')
    ).toBe('true')

    click('settings.theme.system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('shows the cached app version from /api/health', async () => {
    const { fixture, host } = render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="settings.version"]')?.textContent).toContain(
        '0.1.0 · abc1234'
      )
    })
  })

  it('on iOS the install button opens the instructions sheet', () => {
    installMode = 'ios-instructions'
    const { click } = render()

    click('settings.install.action')
    TestBed.tick()

    expect(
      document.querySelector('.cdk-overlay-container [data-testid="settings.install.ios"]')
    ).not.toBeNull()
    expect(document.querySelector('.cdk-overlay-container h2')?.textContent).toBe(
      'Add to your Home Screen'
    )
  })

  it('shows the account section once the session is known', async () => {
    await TestBed.inject(SessionStore).restore()
    // The account section is the settings route's child (features stay independent).
    const harness = await RouterTestingHarness.create('/settings')
    const host = harness.routeNativeElement as HTMLElement

    await vi.waitFor(() => {
      harness.detectChanges()
      expect(host.querySelector('[data-testid="account.section"]')).not.toBeNull()
    })
    expect(host.querySelector('[data-testid="account.signOut"]')).not.toBeNull()
  })

  it('an installed app shows no install button', () => {
    installMode = 'installed'
    const { host } = render()

    expect(host.querySelector('[data-testid="settings.install.action"]')).toBeNull()
    expect(host.querySelector('[data-testid="settings.install"]')?.textContent).toContain(
      'Installed on this device.'
    )
  })
})
