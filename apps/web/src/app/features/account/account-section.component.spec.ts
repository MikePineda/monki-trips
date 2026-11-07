import { Dialog } from '@angular/cdk/dialog'
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
import { OutboxStore } from '../../core/offline/outbox.store'
import { SessionStore } from '../../core/session/session.store'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { AccountSectionComponent } from './account-section.component'

describe('AccountSectionComponent', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    TestBed.configureTestingModule({
      imports: [AccountSectionComponent, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
    })
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    await resetOfflineTesting(db)
  })

  async function render() {
    await TestBed.inject(SessionStore).restore()
    const fixture = TestBed.createComponent(AccountSectionComponent)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')
    return {
      fixture,
      host,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
      sheet: (id: string) => overlay()?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null,
      sheetClick: async (id: string) => {
        overlay()!.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
      sheetType: (id: string, value: string) =>
        typeInto(overlay()!.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!, value),
      sheetSubmit: async () => {
        overlay()!
          .querySelector('form')!
          .dispatchEvent(new Event('submit', { cancelable: true }))
        await settle(fixture)
      },
    }
  }

  it('shows the profile with the e-mail read-only and verified', async () => {
    const { host, text } = await render()

    expect(host.querySelector<HTMLInputElement>('[data-testid="account.displayName"]')?.value).toBe(
      'Traveller'
    )
    expect(host.querySelector<HTMLInputElement>('[data-testid="account.email"]')?.readOnly).toBe(
      true
    )
    expect(text('account.emailState')).toContain(SCOPE_CATALOGUES.account.en.profile.verified)
  })

  it('saving a new display name updates the session', async () => {
    const { fixture, host, click } = await render()

    typeInto(host.querySelector<HTMLInputElement>('[data-testid="account.displayName"]')!, 'Kiko')
    await settle(fixture)
    await click('account.displayName.save')

    expect(fakes.account.calls).toContain('updateProfile')
    expect(TestBed.inject(SessionStore).user()?.displayName).toBe('Kiko')
  })

  it('signs out, forgets the device and goes to sign in', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    const { click } = await render()

    await click('account.signOut')

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
    expect(fakes.session.calls).toContain('logout')
    expect(TestBed.inject(SessionStore).signedIn()).toBe(false)
  })

  it('a failing sign-out stays signed in and says so next to the button, ready to retry', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    const { click, text, has } = await render()
    fakes.session.failWith = new ApiFailure({ kind: 'http', status: 503, message: 'x' })

    await click('account.signOut')

    expect(TestBed.inject(SessionStore).signedIn()).toBe(true)
    expect(navigate).not.toHaveBeenCalled()
    expect(text('account.signOut.error')).toBe(SCOPE_CATALOGUES.account.en.errors.unknown)
    expect(has('account.signOut')).toBe(true)

    await click('account.signOut')

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
  })

  it('sign-out warns when the outbox has pending items', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    const outbox = TestBed.inject(OutboxStore)
    await outbox.enqueue({ tripId: 't1', kind: 'expense.create', payload: {} })
    await outbox.enqueue({ tripId: 't1', kind: 'expense.create', payload: {} })
    const { click, sheet, sheetClick } = await render()
    await vi.waitFor(() => expect(outbox.pendingCount()).toBe(2))

    await click('account.signOut')

    expect(sheet('account.signOut.warning')?.textContent).toContain('2 changes')
    expect(fakes.session.calls).not.toContain('logout')

    await sheetClick('account.signOut.cancel')
    expect(TestBed.inject(SessionStore).signedIn()).toBe(true)

    await click('account.signOut')
    await sheetClick('account.signOut.confirm')
    await vi.waitFor(() => expect(fakes.session.calls).toContain('logout'))
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
  })

  it('signing out everywhere keeps this session', async () => {
    const { click } = await render()

    await click('account.signOutEverywhere')

    expect(fakes.session.calls).toContain('logoutAll')
    expect(TestBed.inject(SessionStore).signedIn()).toBe(true)
    expect(TestBed.inject(ToastService).toasts()[0]?.message).toBe(
      SCOPE_CATALOGUES.account.en.sessions.done
    )
  })

  it('exports the account as a JSON download', async () => {
    const types: string[] = []
    const createObjectURL = vi.fn((blob: Blob) => {
      types.push(blob.type)
      return 'blob:export'
    })
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicked: string[] = []
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicked.push(this.download)
    }
    try {
      const page = await render()
      await page.click('account.export')

      expect(fakes.account.calls).toContain('exportData')
      expect(types).toEqual(['application/json'])
      expect(clicked).toEqual(['monki-trips-export.json'])
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
    } finally {
      HTMLAnchorElement.prototype.click = click
      Reflect.deleteProperty(URL, 'createObjectURL')
      Reflect.deleteProperty(URL, 'revokeObjectURL')
    }
  })

  it('changing the password goes through the sheet and confirms', async () => {
    const { click, sheetType, sheetSubmit } = await render()

    await click('account.password.change')
    sheetType('account.password.current', 'the old password')
    sheetType('account.password.new', 'the new longer password')
    await sheetSubmit()

    expect(fakes.account.calls).toContain('changePassword')
    expect(TestBed.inject(ToastService).toasts()[0]?.message).toBe(
      SCOPE_CATALOGUES.account.en.password.changed
    )
  })

  it('delete account lists the trips that block it', async () => {
    await db.trips.put({
      id: 'trip-shared',
      name: 'Shared trip',
      startDate: '2027-01-20',
      endDate: '2027-02-06',
      baseCurrency: 'EUR',
      updatedAt: '2026-11-07T00:00:00.000Z',
    })
    const { click, sheetType, sheetSubmit, sheet } = await render()
    fakes.account.failWith = new ApiFailure({
      kind: 'http',
      status: 409,
      code: 'E_SOLE_OWNER_OF_SHARED_TRIPS',
      message: 'blocked',
      details: { tripIds: ['trip-shared', 'trip-elsewhere'] },
    })

    await click('account.delete')
    sheetType('account.delete.password', 'my password')
    await sheetSubmit()

    const blocked = sheet('account.delete.blocked')
    expect(blocked?.textContent).toContain(SCOPE_CATALOGUES.account.en.delete.blockedTitle)
    const trips = [
      ...(blocked?.querySelectorAll('[data-testid="account.delete.blockingTrip"]') ?? []),
    ]
    expect(trips.map((trip) => trip.textContent?.trim())).toEqual([
      'Shared trip',
      SCOPE_CATALOGUES.account.en.delete.unknownTrip,
    ])
    expect(trips[0]?.getAttribute('href')).toBe('/t/trip-shared/more/members')
    expect(TestBed.inject(SessionStore).signedIn()).toBe(true)
  })

  it('a wrong password on deletion is explained in the sheet', async () => {
    const { click, sheetType, sheetSubmit, sheet } = await render()
    fakes.account.failWith = new ApiFailure({
      kind: 'http',
      status: 403,
      code: 'E_INVALID_PASSWORD',
      message: 'wrong',
    })

    await click('account.delete')
    sheetType('account.delete.password', 'not it')
    await sheetSubmit()

    expect(sheet('account.delete.error')?.textContent?.trim()).toBe(
      SCOPE_CATALOGUES.account.en.errors.E_INVALID_PASSWORD
    )
  })

  it('a scheduled deletion signs out and leaves', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    const { click, sheetType, sheetSubmit } = await render()

    await click('account.delete')
    sheetType('account.delete.password', 'my password')
    await sheetSubmit()

    expect(fakes.account.calls).toContain('deleteAccount')
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
    expect(TestBed.inject(SessionStore).signedIn()).toBe(false)
  })
})
