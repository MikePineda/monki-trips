import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
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
import SignupPage from './signup.page'

const TOKEN = 'invitation-token-0123456789abcdef'

describe('SignupPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    fakes.session.user = null
    TestBed.configureTestingModule({
      imports: [SignupPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  async function render(inputs: Record<string, string> = {}) {
    const fixture = TestBed.createComponent(SignupPage)
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
      type: (id: string, value: string) =>
        typeInto(host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!, value),
      submit: async () => {
        host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
        await settle(fixture)
      },
    }
  }

  it('shows the form while registration is open', async () => {
    const { has } = await render()

    expect(has('signup.submit')).toBe(true)
    expect(has('signup.closed')).toBe(false)
  })

  it('signup is hidden while registration is closed and no invitation is present', async () => {
    fakes.auth.appConfig = { ...fakes.auth.appConfig, registrationOpen: false }
    const { has, text } = await render()

    expect(has('signup.submit')).toBe(false)
    expect(text('signup.closed')).toContain(SCOPE_CATALOGUES.auth.en.signup.closedTitle)
    expect(fakes.auth.calls).toEqual(['config'])
  })

  it('invitation preview renders trip name and role', async () => {
    fakes.auth.appConfig = { ...fakes.auth.appConfig, registrationOpen: false }
    fakes.auth.invitation = { tripName: 'Winter escape', role: 'editor', requiresEmail: true }
    const { has, text } = await render({ invitation: TOKEN })

    expect(has('signup.submit')).toBe(true)
    expect(text('signup.invited')).toContain('You were invited to Winter escape as editor.')
    expect(text('signup.invited')).toContain(SCOPE_CATALOGUES.auth.en.signup.invitedEmail)
    expect(fakes.auth.calls).toContain(`invitationPreview:${TOKEN}`)
  })

  it('an unverified account goes on to verify its e-mail', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    const { type, submit } = await render()

    type('signup.displayName', 'Traveller')
    type('signup.email', 'new@example.com')
    type('signup.password', 'a long enough password')
    await submit()

    expect(fakes.auth.calls).toContain('signup:new@example.com')
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/verify-email'))
  })

  it('an account verified by its invitation lands on the trips', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    const { type, submit } = await render({ invitation: TOKEN })

    type('signup.displayName', 'Traveller')
    type('signup.email', 'new@example.com')
    type('signup.password', 'a long enough password')
    await submit()

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/trips'))
  })

  it('a taken e-mail is explained in the form', async () => {
    const { type, submit, text } = await render()
    fakes.auth.failWith = new ApiFailure({
      kind: 'http',
      status: 409,
      code: 'E_EMAIL_TAKEN',
      message: 'taken',
    })

    type('signup.displayName', 'Traveller')
    type('signup.email', 'new@example.com')
    type('signup.password', 'a long enough password')
    await submit()

    expect(text('signup.error')).toBe(SCOPE_CATALOGUES.auth.en.errors.E_EMAIL_TAKEN)
  })
})
