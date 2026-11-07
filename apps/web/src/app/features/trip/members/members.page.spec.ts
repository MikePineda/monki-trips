import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import type { Traveller, TripMember } from '@monkitrips/shared'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../../testing/api-testing'
import { fakeInvitation, fakeTrip } from '../../../../testing/fake-trips-api'
import { FAKE_SESSION_USER } from '../../../../testing/fake-session-api'
import { i18nTesting } from '../../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../../testing/offline-testing'
import { settle, typeInto } from '../../../../testing/settle'
import { ApiFailure } from '../../../core/api/api-failure'
import type { MonkiTripsDb } from '../../../core/offline/db'
import { META_DEVICE_USER, META_SESSION } from '../../../core/offline/meta.store'
import { OnlineStore } from '../../../core/offline/online.store'
import { SessionStore } from '../../../core/session/session.store'
import MembersPage from './members.page'

const MEMBERS: TripMember[] = [
  {
    id: 'm1',
    tripId: 'trip-1',
    userId: FAKE_SESSION_USER.id,
    role: 'owner',
    displayName: 'Traveller',
    joinedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    id: 'm2',
    tripId: 'trip-1',
    userId: 'partner',
    role: 'editor',
    displayName: 'Partner',
    joinedAt: '2026-11-07T00:00:00.000Z',
  },
]

/** The same two people seen by the partner: the signed-in person is the editor. */
const MEMBERS_AS_EDITOR: TripMember[] = [
  { ...MEMBERS[0], userId: 'someone-else', displayName: 'Owner' },
  { ...MEMBERS[1], userId: FAKE_SESSION_USER.id, displayName: 'Traveller' },
]

const TRAVELLERS: Traveller[] = [
  {
    id: 'tv-1',
    tripId: 'trip-1',
    displayName: 'Traveller',
    userId: FAKE_SESSION_USER.id,
    position: 0,
  },
  { id: 'tv-2', tripId: 'trip-1', displayName: 'Partner', userId: 'partner', position: 1 },
]

const TOKEN = /fake-invitation-token/

describe('MembersPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    fakes.trips.trips = [{ ...fakeTrip({ homeTz: 'Asia/Bangkok' }), role: 'owner', memberCount: 2 }]
    fakes.trips.membersByTrip.set('trip-1', MEMBERS)
    fakes.trips.travellersByTrip.set('trip-1', TRAVELLERS)
    TestBed.configureTestingModule({
      imports: [MembersPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(fakes),
        provideRouter([{ path: 'trips', children: [] }]),
      ],
    })
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    await resetOfflineTesting(db)
  })

  async function render() {
    await TestBed.inject(SessionStore).restore()
    const fixture = TestBed.createComponent(MembersPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')
    const all = (id: string) => [...host.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
    const has = (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null
    /** Dexie answers over several macrotasks: polls the DOM (after change detection) until `check` holds. */
    const until = (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    // The members load on open; wait until the list (or its failure) is on screen.
    await until(() => expect(has('trip.members.list') || has('trip.members.error')).toBe(true))
    return {
      fixture,
      host,
      all,
      has,
      until,
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
      rows: (id: string) =>
        all(id).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      click: async (id: string, index = 0) => {
        all(id)[index].click()
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

  function asEditor() {
    fakes.trips.membersByTrip.set('trip-1', MEMBERS_AS_EDITOR)
    fakes.trips.trips = [{ ...fakeTrip(), role: 'editor', memberCount: 2 }]
  }

  it('lists the members with their roles, marking the signed-in person', async () => {
    const { rows, all } = await render()

    const texts = rows('trip.members.item')
    expect(texts).toHaveLength(2)
    expect(texts[0]).toContain('Traveller (you)')
    expect(texts[0]).toContain('Owner')
    expect(texts[1]).toContain('Partner')
    expect(texts[1]).toContain('Editor')
    expect(texts[1]).not.toContain('(you)')
    expect(all('trip.members.role').map((chip) => chip.dataset['role'])).toEqual([
      'owner',
      'editor',
    ])
    // Dates follow the trip's zone: midnight UTC is already the 7th in Bangkok.
    expect(texts[0]).toContain('Joined 7 Nov')
  })

  it('link invitation url is shown once', async () => {
    const { has, click, text, rows } = await render()

    expect(has('trip.members.inviteLink')).toBe(true)
    await click('trip.members.inviteLink')

    expect(fakes.trips.calls).toContain('inviteByLink:trip-1')
    expect(text('trip.members.linkUrl')).toBe(
      'http://localhost/invite/fake-invitation-token-0123456789'
    )
    expect(has('trip.members.copy')).toBe(true)
    expect(has('trip.members.inviteLink')).toBe(false)
    // The new invitation joins the pending list, without its token.
    expect(rows('trip.members.invitation')).toEqual([expect.stringContaining('Invitation link')])
    expect(rows('trip.members.invitation')[0]).not.toMatch(TOKEN)
  })

  it('email invitation never shows a token', async () => {
    const { host, has, text, rows, fixture } = await render()

    typeInto(
      host.querySelector<HTMLInputElement>('[data-testid="trip.members.inviteEmail"]')!,
      'partner@example.com'
    )
    host
      .querySelector('[data-testid="trip.members.inviteSection"] form')!
      .dispatchEvent(new Event('submit', { cancelable: true }))
    await settle(fixture)

    expect(fakes.trips.calls).toContain('inviteByEmail:trip-1:partner@example.com')
    expect(text('trip.members.emailSent')).toContain('Invitation sent to partner@example.com')
    expect(rows('trip.members.invitation')).toEqual([
      expect.stringContaining('partner@example.com'),
    ])
    expect(host.textContent).not.toMatch(TOKEN)
    expect(has('trip.members.link')).toBe(false)
  })

  it('an address the form cannot accept never reaches the server', async () => {
    const { host, fixture } = await render()

    typeInto(
      host.querySelector<HTMLInputElement>('[data-testid="trip.members.inviteEmail"]')!,
      'not-an-address'
    )
    host
      .querySelector('[data-testid="trip.members.inviteSection"] form')!
      .dispatchEvent(new Event('submit', { cancelable: true }))
    await settle(fixture)

    expect(fakes.trips.calls.some((call) => call.startsWith('inviteByEmail'))).toBe(false)
    expect(host.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0)
  })

  it('editor sees leave but not owner actions', async () => {
    asEditor()
    const { has } = await render()

    expect(has('trip.members.inviteSection')).toBe(false)
    expect(has('trip.members.invitations')).toBe(false)
    expect(has('trip.members.makeOwner')).toBe(false)
    expect(has('trip.members.remove')).toBe(false)
    expect(has('trip.members.leave')).toBe(true)
    expect(fakes.trips.calls.some((call) => call.startsWith('invitations:'))).toBe(false)
  })

  it('leaving asks first, then forgets the trip on the device and goes back to the list', async () => {
    asEditor()
    await db.trips.put({
      id: 'trip-1',
      name: 'Sample trip',
      startDate: '2027-01-20',
      endDate: '2027-02-06',
      baseCurrency: 'EUR',
      updatedAt: 'x',
    })
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
    const { click, sheet, sheetClick } = await render()

    await click('trip.members.leave')
    expect(sheet('ui.confirm.confirm')?.textContent?.trim()).toBe('Leave')
    await sheetClick('ui.confirm.confirm')

    expect(fakes.trips.calls).toContain('removeMember:trip-1:m2')
    await vi.waitFor(async () => expect(await db.trips.get('trip-1')).toBeUndefined())
    expect(await db.travellers.where('tripId').equals('trip-1').count()).toBe(0)
    expect(navigate).toHaveBeenCalledWith(['/trips'])
  })

  it('the server refusing a departure (E_OWNER_CANNOT_LEAVE) is explained above the list', async () => {
    asEditor()
    const { click, sheetClick, text } = await render()

    await click('trip.members.leave')
    fakes.trips.failWith = new ApiFailure({
      kind: 'http',
      status: 409,
      code: 'E_OWNER_CANNOT_LEAVE',
      message: 'server words',
    })
    await sheetClick('ui.confirm.confirm')

    expect(text('trip.members.actionError')).toBe('Transfer ownership to someone else first.')
    expect(await db.trips.count()).toBe(0)
  })

  it('transfer ownership requires confirmation', async () => {
    const { click, sheet, sheetClick, rows, all, has } = await render()

    await click('trip.members.makeOwner')
    expect(sheet('ui.confirm.body')?.textContent).toContain('Partner becomes the owner')
    expect(sheet('ui.confirm.confirm')?.textContent?.trim()).toBe('Make Partner the owner')
    await sheetClick('ui.confirm.cancel')
    expect(fakes.trips.calls.some((call) => call.startsWith('transferOwnership'))).toBe(false)

    await click('trip.members.makeOwner')
    await sheetClick('ui.confirm.confirm')

    expect(fakes.trips.calls).toContain('transferOwnership:trip-1:partner')
    const texts = rows('trip.members.item')
    expect(texts[0]).toContain('Partner')
    expect(texts[0]).toContain('Owner')
    expect(texts[1]).toContain('Traveller (you)')
    expect(texts[1]).toContain('Editor')
    expect(all('trip.members.role').map((chip) => chip.dataset['role'])).toEqual([
      'owner',
      'editor',
    ])
    // Roles swapped: the owner-only sections are gone and the way out appears.
    expect(has('trip.members.inviteSection')).toBe(false)
    expect(has('trip.members.leave')).toBe(true)
  })

  it('removing a member asks first and then drops the row', async () => {
    const { click, sheetClick, rows } = await render()

    await click('trip.members.remove')
    await sheetClick('ui.confirm.confirm')

    expect(fakes.trips.calls).toContain('removeMember:trip-1:m2')
    expect(rows('trip.members.item')).toHaveLength(1)
  })

  it('the owner revokes a pending invitation; an expired one only shows its state', async () => {
    fakes.trips.invitationsByTrip.set('trip-1', [
      fakeInvitation({ id: 'inv-pending', email: 'friend@example.com' }),
      fakeInvitation({ id: 'inv-expired', email: null, state: 'expired' }),
      fakeInvitation({ id: 'inv-accepted', email: null, state: 'accepted' }),
    ])
    const { rows, all, click, sheetClick, has } = await render()

    const before = rows('trip.members.invitation')
    expect(before).toHaveLength(2)
    expect(before[0]).toContain('friend@example.com')
    expect(before[1]).toContain('Invitation link')
    expect(before[1]).toContain('Expired')
    expect(all('trip.members.revoke')).toHaveLength(1)

    await click('trip.members.revoke')
    await sheetClick('ui.confirm.confirm')

    expect(fakes.trips.calls).toContain('revokeInvitation:trip-1:inv-pending')
    expect(rows('trip.members.invitation')).toHaveLength(1)
    expect(has('trip.members.revoke')).toBe(false)
  })

  it('traveller without account can be added', async () => {
    const { rows, click, sheetType, sheetSubmit, all, until } = await render()

    await until(() =>
      expect(rows('trip.members.traveller')).toEqual([
        expect.stringContaining('Traveller'),
        expect.stringContaining('Partner'),
      ])
    )
    expect(all('trip.members.removeTraveller')).toHaveLength(0)

    await click('trip.members.addTraveller')
    sheetType('trip.members.travellerName', 'Little one')
    await sheetSubmit()

    await until(() => expect(rows('trip.members.traveller')).toHaveLength(3))
    const texts = rows('trip.members.traveller')
    expect(texts[2]).toContain('Little one')
    expect(texts[2]).toContain('No account')
    expect(texts[2]).toContain('Pending')
    expect(all('trip.members.removeTraveller')).toHaveLength(1)
    const outbox = await db.outbox.toArray()
    expect(outbox.map((entry) => entry.kind)).toEqual(['traveller.upsert'])
    expect(outbox[0].tripId).toBe('trip-1')
  })

  it('a traveller is renamed from a sheet and a person without account can be removed', async () => {
    const { rows, click, sheetType, sheetSubmit, sheetClick, until } = await render()
    await until(() => expect(rows('trip.members.traveller')).toHaveLength(2))
    await click('trip.members.addTraveller')
    sheetType('trip.members.travellerName', 'Little one')
    await sheetSubmit()
    await until(() => expect(rows('trip.members.traveller')).toHaveLength(3))

    await click('trip.members.renameTraveller', 2)
    sheetType('trip.members.travellerName', 'Small one')
    await sheetSubmit()
    await until(() => expect(rows('trip.members.traveller')[2]).toContain('Small one'))

    await click('trip.members.removeTraveller')
    await sheetClick('ui.confirm.confirm')

    await until(() => expect(rows('trip.members.traveller')).toHaveLength(2))
    expect((await db.outbox.toArray()).map((entry) => entry.kind)).toEqual([
      'traveller.upsert',
      'traveller.upsert',
      'traveller.delete',
    ])
  })

  it('offline, the travellers of the device show and inviting waits for a connection', async () => {
    await db.travellers.put({
      id: 'tv-9',
      tripId: 'trip-1',
      displayName: 'Cached one',
      userId: null,
      position: 0,
      updatedAt: 'x',
    })
    // Offline, the session comes from the device's cache.
    await db.meta.bulkPut([
      { key: META_SESSION, value: FAKE_SESSION_USER },
      { key: META_DEVICE_USER, value: FAKE_SESSION_USER.id },
    ])
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    const { rows, has, host, until } = await render()

    await until(() =>
      expect(rows('trip.members.traveller')).toEqual([expect.stringContaining('Cached one')])
    )
    expect(fakes.trips.calls.some((call) => call.startsWith('snapshot'))).toBe(false)
    expect(has('trip.members.offline')).toBe(true)
    expect(
      host.querySelector<HTMLButtonElement>('[data-testid="trip.members.inviteLink"]')?.disabled
    ).toBe(true)
  })
})
