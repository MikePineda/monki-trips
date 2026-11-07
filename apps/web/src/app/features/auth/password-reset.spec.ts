import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import { SCOPE_CATALOGUES } from '../../../testing/i18n-scopes'
import { i18nTesting } from '../../../testing/i18n-testing'
import { settle, typeInto } from '../../../testing/settle'
import { ApiFailure } from '../../core/api/api-failure'
import ForgotPasswordPage from './forgot-password.page'
import ResetPasswordPage from './reset-password.page'

describe('password reset screens', () => {
  let fakes: ApiFakes

  beforeEach(() => {
    fakes = apiFakes()
    TestBed.configureTestingModule({
      imports: [ForgotPasswordPage, ResetPasswordPage, i18nTesting()],
      providers: [...provideApiTesting(fakes), provideRouter([])],
    })
  })

  async function render<T>(page: new () => T, inputs: Record<string, string> = {}) {
    const fixture = TestBed.createComponent(page)
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value)
    }
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
      type: (id: string, value: string) =>
        typeInto(host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!, value),
      submit: async () => {
        host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
        await settle(fixture)
      },
    }
  }

  describe('forgot password', () => {
    it('always confirms that a link may be on its way', async () => {
      const { type, submit, text } = await render(ForgotPasswordPage)

      type('forgot.email', 'someone@example.com')
      await submit()

      expect(fakes.auth.calls).toEqual(['forgotPassword:someone@example.com'])
      expect(text('forgot.sent')).toContain('someone@example.com')
    })

    it('a throttle is explained instead of pretending the mail went out', async () => {
      const { type, submit, text, has } = await render(ForgotPasswordPage)
      fakes.auth.failWith = new ApiFailure({
        kind: 'http',
        status: 429,
        code: 'E_TOO_MANY_REQUESTS',
        message: 'slow down',
        retryAfterSeconds: 120,
      })

      type('forgot.email', 'someone@example.com')
      await submit()

      expect(has('forgot.sent')).toBe(false)
      expect(text('forgot.error')).toBe('Too many attempts. Try again in 2 min.')
    })
  })

  describe('reset password', () => {
    it('without a token it asks for the link from the e-mail', async () => {
      const { has } = await render(ResetPasswordPage)

      expect(has('reset.missingToken')).toBe(true)
      expect(has('reset.password')).toBe(false)
    })

    it('a new password against the token signs every session out and goes to sign in', async () => {
      const { type, submit, text } = await render(ResetPasswordPage, {
        token: 'reset-token-0123456789',
      })

      type('reset.password', 'a brand new password')
      await submit()

      expect(fakes.auth.calls).toEqual(['resetPassword:reset-token-0123456789'])
      expect(text('reset.done')).toContain(SCOPE_CATALOGUES.auth.en.reset.doneTitle)
    })

    it('the reset token leaves the address bar and history as soon as the page holds it', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
      const { fixture, type, submit, has } = await render(ResetPasswordPage, {
        token: 'reset-token-0123456789',
      })

      expect(navigate).toHaveBeenCalledWith(['/reset-password'], { replaceUrl: true })
      // The router drops the query parameter: the page still holds the token.
      fixture.componentRef.setInput('token', undefined)
      await settle(fixture)
      expect(has('reset.password')).toBe(true)

      type('reset.password', 'a brand new password')
      await submit()

      expect(fakes.auth.calls).toEqual(['resetPassword:reset-token-0123456789'])
    })

    it('a short password never reaches the server', async () => {
      const { type, submit } = await render(ResetPasswordPage, { token: 'reset-token-0123456789' })

      type('reset.password', 'short')
      await submit()

      expect(fakes.auth.calls).toEqual([])
    })

    it('an expired link offers to request a new one', async () => {
      const { type, submit, has } = await render(ResetPasswordPage, {
        token: 'reset-token-0123456789',
      })
      fakes.auth.failWith = new ApiFailure({
        kind: 'http',
        status: 410,
        code: 'E_TOKEN_EXPIRED',
        message: 'gone',
      })

      type('reset.password', 'a brand new password')
      await submit()

      expect(has('reset.expired')).toBe(true)
      expect(has('reset.request')).toBe(true)
    })
  })
})
