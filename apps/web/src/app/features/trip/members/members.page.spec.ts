import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import type { TripMember } from '@monkitrips/shared'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { FAKE_SESSION_USER } from '../../../testing/fake-session-api'
import { SessionStore } from '../../core/session/session.store'
import { provideShellI18n } from '../../layouts/shell/shell-i18n'
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

describe('MembersPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    fakes.trips.membersByTrip.set('trip-1', MEMBERS)
    TestBed.configureTestingModule({
      imports: [MembersPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(fakes),
        provideRouter([]),
        provideShellI18n(),
      ],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  async function render() {
    await TestBed.inject(SessionStore).restore()
    const fixture = TestBed.createComponent(MembersPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      text: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim(),
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
    }
  }

  it('lists the members with their roles, marking the signed-in person', async () => {
    const { host } = await render()
    const items = [...host.querySelectorAll('[data-testid="trip.members.item"]')]

    const texts = items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    expect(texts).toHaveLength(2)
    expect(texts[0]).toContain('Traveller (you)')
    expect(texts[0]).toContain('Owner')
    expect(texts[1]).toContain('Partner')
    expect(texts[1]).toContain('Editor')
    expect(texts[1]).not.toContain('(you)')
  })

  it('the owner can invite by link and sees the link exactly once, with a copy button', async () => {
    const { has, click, text } = await render()

    expect(has('trip.members.inviteLink')).toBe(true)
    await click('trip.members.inviteLink')

    expect(fakes.trips.calls).toContain('inviteByLink:trip-1')
    expect(text('trip.members.linkUrl')).toBe(
      'http://localhost/invite/fake-invitation-token-0123456789'
    )
    expect(has('trip.members.copy')).toBe(true)
    expect(has('trip.members.inviteLink')).toBe(false)
  })

  it('an editor sees no invitation controls', async () => {
    fakes.trips.membersByTrip.set('trip-1', [
      { ...MEMBERS[0], userId: 'someone-else' },
      { ...MEMBERS[1], userId: FAKE_SESSION_USER.id },
    ])
    const { has } = await render()

    expect(has('trip.members.inviteSection')).toBe(false)
  })
})
