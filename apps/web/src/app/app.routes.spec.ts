import { TestBed } from '@angular/core/testing'
import { Router, provideRouter, withComponentInputBinding } from '@angular/router'
import { RouterTestingHarness } from '@angular/router/testing'
import { i18nTesting } from '../testing/i18n-testing'
import { providePwaTesting } from '../testing/pwa-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../testing/offline-testing'
import type { MonkiTripsDb } from './core/offline/db'
import { META_ACTIVE_TRIP, MetaStore } from './core/offline/meta.store'
import { FakeSessionApi, SESSION_API } from './core/session/session-api'
import { routes } from './app.routes'

describe('app routes', () => {
  let db: MonkiTripsDb
  let api: FakeSessionApi

  beforeEach(() => {
    db = freshOfflineDb()
    api = new FakeSessionApi()
    TestBed.configureTestingModule({
      imports: [i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        { provide: SESSION_API, useValue: api },
        providePwaTesting(),
        provideRouter(routes, withComponentInputBinding()),
      ],
    })
  })

  afterEach(async () => {
    harness = undefined
    await resetOfflineTesting(db)
  })

  let harness: RouterTestingHarness | undefined

  /** One harness per test; later calls navigate the same one. */
  async function navigate(url: string) {
    harness ??= await RouterTestingHarness.create()
    await harness.navigateByUrl(url)
    harness.detectChanges()
    const root = harness.routeNativeElement?.ownerDocument.body
    return {
      harness,
      url: TestBed.inject(Router).url,
      has: (testId: string) => root?.querySelector(`[data-testid="${testId}"]`) !== null,
    }
  }

  it('the root opens the trip list inside the shell, with the empty state', async () => {
    const { url, has } = await navigate('/')

    expect(url).toBe('/trips')
    expect(has('shell.name')).toBe(true)
    expect(has('trips.empty')).toBe(true)
    expect(has('shell.tab.today')).toBe(false)
  })

  it('the sign-in placeholder lives in the auth layout', async () => {
    const { has } = await navigate('/login')

    expect(has('login.placeholder')).toBe(true)
    expect(has('shell.nav.settings')).toBe(false)
  })

  it('an anonymous online visitor is sent to /login', async () => {
    api.user = null

    const { url } = await navigate('/trips')

    expect(url).toBe('/login?next=%2Ftrips')
  })

  it('the style guide is public and marked noindex', async () => {
    const { has } = await navigate('/styleguide')

    expect(has('styleguide.tokens')).toBe(true)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex'
    )
  })

  it('a trip opens on Today inside the trip shell with the five tabs', async () => {
    const { url, has } = await navigate('/t/demo-trip')

    expect(url).toBe('/t/demo-trip/today')
    expect(has('trip.today.title')).toBe(true)
    for (const tab of ['today', 'plan', 'docs', 'money', 'more']) {
      expect(has(`shell.tab.${tab}`), tab).toBe(true)
    }
    expect(has('shell.back')).toBe(true)
  })

  it('entering a trip makes it the active one for the shortcut', async () => {
    await navigate('/t/demo-trip/money')

    await vi.waitFor(async () =>
      expect(await TestBed.inject(MetaStore).get(META_ACTIVE_TRIP)).toBe('demo-trip')
    )
    const { url } = await navigate('/t/current/add')
    expect(url).toBe('/t/demo-trip/add')
  })

  it('more lists settings and offline, each reachable', async () => {
    expect((await navigate('/t/demo-trip/more')).has('trip.more.settings')).toBe(true)
    expect((await navigate('/t/demo-trip/more/settings')).has('settings.theme.dark')).toBe(true)
    expect((await navigate('/t/demo-trip/more/offline')).has('offline.ready')).toBe(true)
  })

  it('the share inbox and settings are reachable outside a trip', async () => {
    expect((await navigate('/share')).has('share.placeholder')).toBe(true)
    expect((await navigate('/settings')).has('settings.lang.en')).toBe(true)
  })

  it('unknown paths fall back to the trip list', async () => {
    expect((await navigate('/nowhere')).url).toBe('/trips')
  })
})
