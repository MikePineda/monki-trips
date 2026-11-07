import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { TranslocoService } from '@jsverse/transloco'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
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
import LoginPage from './login.page'

describe('LoginPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    fakes.session.user = null
    TestBed.configureTestingModule({
      imports: [LoginPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  async function render(inputs: Record<string, string> = {}) {
    const fixture = TestBed.createComponent(LoginPage)
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value)
    }
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const field = (id: string) => host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!
    return {
      fixture,
      host,
      type: (id: string, value: string) => typeInto(field(id), value),
      submit: async () => {
        host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
        await settle(fixture)
      },
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
    }
  }

  it('renders the form with the forgot-password link', async () => {
    const { host } = await render()

    expect(host.querySelector('h1')?.textContent).toBe('Sign in')
    expect(host.querySelector('[data-testid="login.forgot"]')?.getAttribute('href')).toBe(
      '/forgot-password'
    )
  })

  it('refuses an empty form without calling the server', async () => {
    const { host, submit } = await render()

    await submit()

    expect(fakes.session.calls.filter((call) => call.startsWith('login'))).toEqual([])
    expect(host.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0)
  })

  it('login shows the api error code message', async () => {
    const { type, submit, text } = await render()
    fakes.session.failWith = new ApiFailure({
      kind: 'http',
      status: 401,
      code: 'E_INVALID_CREDENTIALS',
      message: 'server words',
    })

    type('login.email', 'owner@example.com')
    type('login.password', 'not the password')
    await submit()

    expect(text('login.error')).toBe(SCOPE_CATALOGUES.auth.en.errors.E_INVALID_CREDENTIALS)
  })

  it('a throttle says how many minutes to wait', async () => {
    const { type, submit, text } = await render()
    fakes.session.failWith = new ApiFailure({
      kind: 'http',
      status: 429,
      code: 'E_TOO_MANY_REQUESTS',
      message: 'slow down',
      retryAfterSeconds: 600,
    })

    type('login.email', 'owner@example.com')
    type('login.password', 'not the password')
    await submit()

    expect(text('login.error')).toBe('Too many attempts. Try again in 10 min.')
  })

  it('the error follows a language switch', async () => {
    const { fixture, type, submit, text } = await render()
    fakes.session.failWith = new ApiFailure({ kind: 'network', message: 'offline' })
    type('login.email', 'owner@example.com')
    type('login.password', 'whatever it is')
    await submit()

    TestBed.inject(TranslocoService).setActiveLang('es')
    fixture.detectChanges()

    expect(text('login.error')).toBe(SCOPE_CATALOGUES.auth.es.errors.network)
  })

  it('signs in and goes to the return url inside the app', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    const { type, submit } = await render({ returnUrl: '/t/trip-1/money' })

    type('login.email', 'owner@example.com')
    type('login.password', 'correct horse battery')
    await submit()

    expect(fakes.session.calls).toContain('login:owner@example.com')
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/t/trip-1/money'))
  })

  it('never follows a return url that leaves the app', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    const { type, submit } = await render({ returnUrl: 'https://example.com/evil' })

    type('login.email', 'owner@example.com')
    type('login.password', 'correct horse battery')
    await submit()

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/trips'))
  })

  it('keeps the invitation token on the signup link', async () => {
    const { host } = await render({ invitation: 'invitation-token-0123456789abcdef' })

    expect(host.querySelector('[data-testid="login.signup"]')?.getAttribute('href')).toBe(
      '/signup?invitation=invitation-token-0123456789abcdef'
    )
  })
})
