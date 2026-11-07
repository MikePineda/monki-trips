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
import { settle } from '../../../testing/settle'
import { ApiFailure } from '../../core/api/api-failure'
import { SessionStore } from '../../core/session/session.store'
import type { MonkiTripsDb } from '../../core/offline/db'
import InvitePage from './invite.page'

const TOKEN = 'invitation-token-0123456789abcdef'

describe('InvitePage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    TestBed.configureTestingModule({
      imports: [InvitePage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  async function render() {
    // The session is known before the page renders, as the guards leave it in the app.
    await TestBed.inject(SessionStore).restore()
    const fixture = TestBed.createComponent(InvitePage)
    fixture.componentRef.setInput('token', TOKEN)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
      href: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.getAttribute('href'),
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
    }
  }

  it('invitation preview renders trip name and role', async () => {
    fakes.auth.invitation = { tripName: 'Winter escape', role: 'editor', requiresEmail: false }
    const { text } = await render()

    expect(text('auth.invite.preview')).toBe('Join Winter escape as editor.')
    expect(fakes.auth.calls).toContain(`invitationPreview:${TOKEN}`)
  })

  it('someone signed in can join; the trip is cached and opened', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
    const { has, click } = await render()

    expect(has('auth.invite.accept')).toBe(true)
    await click('auth.invite.accept')

    expect(fakes.auth.calls).toContain(`acceptInvitation:${TOKEN}`)
    // The invitation link leaves the history: back does not land on a used token.
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(['/t', 'invited-trip', 'today'], { replaceUrl: true })
    )
    expect((await db.trips.get('invited-trip'))?.name).toBe('Sample trip')
  })

  it('an anonymous visitor gets signup and sign-in links that keep the token', async () => {
    fakes.session.user = null
    const { has, href } = await render()

    expect(has('auth.invite.accept')).toBe(false)
    expect(href('auth.invite.signup')).toBe(`/signup?invitation=${TOKEN}`)
    // The token travels once, inside the return url.
    expect(href('auth.invite.login')).toBe(
      `/login?returnUrl=${encodeURIComponent(`/invite/${TOKEN}`)}`
    )
  })

  it('an unknown token is not found', async () => {
    fakes.auth.failWith = new ApiFailure({
      kind: 'http',
      status: 404,
      code: 'E_ROW_NOT_FOUND',
      message: 'nope',
    })
    const { text } = await render()

    expect(text('auth.invite.notFound')).toContain(SCOPE_CATALOGUES.auth.en.invite.notFoundTitle)
  })

  it('a used or expired invitation says so', async () => {
    fakes.auth.failWith = new ApiFailure({
      kind: 'http',
      status: 410,
      code: 'E_INVITATION_EXPIRED',
      message: 'gone',
    })
    const { text } = await render()

    expect(text('auth.invite.expired')).toContain(SCOPE_CATALOGUES.auth.en.invite.expiredTitle)
  })

  it('a refused acceptance is explained next to the button', async () => {
    const { click, text } = await render()
    fakes.auth.failWith = new ApiFailure({
      kind: 'http',
      status: 403,
      code: 'E_INVITATION_EMAIL_MISMATCH',
      message: 'mismatch',
    })

    await click('auth.invite.accept')

    expect(text('auth.invite.error')).toBe(
      SCOPE_CATALOGUES.auth.en.errors.E_INVITATION_EMAIL_MISMATCH
    )
  })
})
