import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
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
import { FAKE_SESSION_USER } from '../../core/session/session-api'
import { SessionStore } from '../../core/session/session.store'
import VerifyEmailPage from './verify-email.page'

describe('VerifyEmailPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    fakes.session.user = { ...FAKE_SESSION_USER, emailVerifiedAt: null }
    TestBed.configureTestingModule({
      imports: [VerifyEmailPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  async function render(inputs: Record<string, string> = {}) {
    await TestBed.inject(SessionStore).restore()
    const fixture = TestBed.createComponent(VerifyEmailPage)
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value)
    }
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
      input: (id: string) => host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!,
      submit: async () => {
        host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
        await settle(fixture)
      },
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
    }
  }

  it('shows the code form to a signed-in person whose address is unverified', async () => {
    const { has, host } = await render()

    expect(has('verify.code')).toBe(true)
    expect(host.textContent).toContain(FAKE_SESSION_USER.email)
  })

  it('verify code form limits to six digits', async () => {
    const { input, fixture } = await render()
    const code = input('verify.code')

    typeInto(code, '12 34-567x89')
    fixture.detectChanges()

    expect(code.value).toBe('123456')
    expect(code.getAttribute('maxlength')).toBe('6')
    expect(code.getAttribute('inputmode')).toBe('numeric')
  })

  it('a right code verifies the session and offers to continue', async () => {
    const { input, submit, has } = await render()

    typeInto(input('verify.code'), '123456')
    await submit()

    expect(fakes.auth.calls).toContain('verifyCode:123456')
    expect(has('verify.done')).toBe(true)
    expect(TestBed.inject(SessionStore).emailVerified()).toBe(true)
  })

  it('a wrong code is explained and the form stays', async () => {
    const { input, submit, text, has } = await render()
    fakes.auth.failWith = new ApiFailure({
      kind: 'http',
      status: 400,
      code: 'E_INVALID_CODE',
      message: 'wrong',
    })

    typeInto(input('verify.code'), '000000')
    await submit()

    expect(text('verify.error')).toBe(SCOPE_CATALOGUES.auth.en.errors.E_INVALID_CODE)
    expect(has('verify.code')).toBe(true)
  })

  it('resending starts a cooldown that disables the button', async () => {
    const { click, has, input } = await render()

    await click('verify.resend')

    expect(fakes.auth.calls).toContain('resendVerification')
    expect(has('verify.sent')).toBe(true)
    expect(input('verify.resend').hasAttribute('disabled')).toBe(true)
    expect(input('verify.resend').textContent).toContain('60 s')
  })

  it('a link token is redeemed at once', async () => {
    const { has } = await render({ token: 'verify-token-0123456789abcdef' })

    expect(fakes.auth.calls).toContain('verifyEmail:verify-token-0123456789abcdef')
    expect(has('verify.done')).toBe(true)
  })

  it('an expired link says so and points at the code form', async () => {
    fakes.auth.failWith = new ApiFailure({
      kind: 'http',
      status: 410,
      code: 'E_TOKEN_EXPIRED',
      message: 'gone',
    })
    const { text } = await render({ token: 'verify-token-0123456789abcdef' })

    expect(text('verify.expired')).toContain(SCOPE_CATALOGUES.auth.en.verify.linkExpiredTitle)
  })

  it('an anonymous visitor without a token is sent to sign in first', async () => {
    fakes.session.user = null
    const { has, host } = await render()

    expect(has('verify.anonymous')).toBe(true)
    expect(host.querySelector('[data-testid="verify.login"]')?.getAttribute('href')).toBe(
      '/login?returnUrl=%2Fverify-email'
    )
  })
})
