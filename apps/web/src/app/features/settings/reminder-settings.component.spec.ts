import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import type { NotificationSettings, UpcomingReminder } from '@monkitrips/shared'
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
import { MetaStore } from '../../core/offline/meta.store'
import { reminderFireTime } from '../../domain/reminder-fire-time'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { ReminderSettingsComponent } from './reminder-settings.component'
import { META_REMINDER_SETTINGS, META_UPCOMING_REMINDERS } from './reminders.store'

const copy = SCOPE_CATALOGUES.settings.en

/** Where a tapped reminder lands in this spec. */
@Component({ template: '' })
class BlankPage {}

const LEAVE: UpcomingReminder = {
  kind: 'leave_at',
  tripId: 'trip-1',
  refId: 'event-1',
  fireAt: '2026-11-07T18:05:00.000Z',
  title: 'Time to leave',
  body: 'Island hop: leave at 18:05 for the 20:35 flight.',
  url: '/t/trip-1/plan/e/event-1',
}

const CHECK_OUT: UpcomingReminder = {
  kind: 'check_out',
  tripId: 'trip-1',
  refId: 'event-2',
  fireAt: '2026-11-08T08:00:00.000Z',
  title: 'Check-out today',
  body: 'Island hop: check out of Harbour Rooms by 09:00.',
  url: '/t/trip-1/today',
}

const OFF_LEAVE: NotificationSettings = {
  leaveAt: false,
  checkOut: true,
  tasksDue: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

describe('ReminderSettingsComponent', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    TestBed.configureTestingModule({
      imports: [ReminderSettingsComponent, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(fakes),
        provideRouter([{ path: '**', component: BlankPage }]),
      ],
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(ReminderSettingsComponent)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    // The device's copy, then (online) the server's answers, have landed.
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(
        host.querySelector('[data-testid="settings.reminders"]')?.getAttribute('data-ready')
      ).toBe('true')
    })
    await settle(fixture)
    const find = <T extends HTMLElement = HTMLElement>(id: string) =>
      host.querySelector<T>(`[data-testid="${id}"]`)
    return {
      fixture,
      host,
      find,
      checked: (id: string) => find(id)?.getAttribute('aria-checked'),
      disabled: (id: string) => find(id)?.hasAttribute('disabled'),
      rows: () =>
        Array.from(
          host.querySelectorAll<HTMLElement>('[data-testid="settings.reminders.upcoming.row"]')
        ),
      click: async (id: string) => {
        find(id)!.click()
        await settle(fixture, 6)
      },
      type: async (id: string, value: string) => {
        typeInto(find<HTMLInputElement>(id)!, value)
        await settle(fixture)
      },
    }
  }

  it('the toggles and quiet hours load from the server', async () => {
    fakes.reminders.saved = { ...OFF_LEAVE }
    const { checked, find } = await render()

    expect(checked('settings.reminders.leaveAt')).toBe('false')
    expect(checked('settings.reminders.checkOut')).toBe('true')
    expect(checked('settings.reminders.tasksDue')).toBe('true')
    expect(find<HTMLInputElement>('settings.reminders.quietStart')!.value).toBe('22:00')
    expect(find<HTMLInputElement>('settings.reminders.quietEnd')!.value).toBe('07:00')
    expect(find('settings.reminders')!.textContent).toContain(copy.reminders.leaveAt)
  })

  it('a tapped toggle saves the whole settings with the saved quiet hours', async () => {
    fakes.reminders.saved = { ...OFF_LEAVE }
    const { click, checked } = await render()

    await click('settings.reminders.checkOut')

    expect(fakes.reminders.savedBodies).toEqual([{ ...OFF_LEAVE, checkOut: false }])
    expect(checked('settings.reminders.checkOut')).toBe('false')
  })

  it('quiet hours with only one end show the pair error and save nothing', async () => {
    const { type, click, find } = await render()

    await type('settings.reminders.quietStart', '22:00')
    await click('settings.reminders.saveQuiet')

    expect(find('settings.reminders')!.textContent).toContain(copy.reminders.quietPair)
    expect(fakes.reminders.calls).not.toContain('saveSettings')

    await type('settings.reminders.quietEnd', '07:00')
    expect(find('settings.reminders')!.textContent).not.toContain(copy.reminders.quietPair)
  })

  it('both quiet hours save together and confirm in a toast', async () => {
    const { type, click } = await render()

    await type('settings.reminders.quietStart', '22:00')
    await type('settings.reminders.quietEnd', '07:00')
    await click('settings.reminders.saveQuiet')

    expect(fakes.reminders.savedBodies).toEqual([
      {
        leaveAt: true,
        checkOut: true,
        tasksDue: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      },
    ])
    expect(TestBed.inject(ToastService).toasts()[0]?.message).toBe(copy.reminders.saved)
  })

  it('emptying both quiet hours turns them off', async () => {
    fakes.reminders.saved = { ...OFF_LEAVE }
    const { type, click } = await render()

    await type('settings.reminders.quietStart', '')
    await type('settings.reminders.quietEnd', '')
    await click('settings.reminders.saveQuiet')

    expect(fakes.reminders.savedBodies[0]).toMatchObject({
      quietHoursStart: null,
      quietHoursEnd: null,
    })
  })

  it('upcoming reminders list title, body and local fire time, and a tap opens their screen', async () => {
    fakes.reminders.reminders = [LEAVE, CHECK_OUT]
    const { fixture, rows } = await render()

    expect(rows().map((row) => row.getAttribute('data-kind'))).toEqual(['leave_at', 'check_out'])
    const first = rows()[0]!
    expect(first.textContent).toContain(LEAVE.title)
    expect(first.textContent).toContain(LEAVE.body)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(first.textContent).toContain(
      reminderFireTime({
        instant: LEAVE.fireAt,
        now: '2026-11-07T12:00:00.000Z',
        timeZone,
        locale: 'en-AU',
      })
    )

    first.querySelector<HTMLElement>('a')!.click()
    await settle(fixture)

    expect(TestBed.inject(Router).url).toBe(LEAVE.url)
  })

  it('turning a kind off plans again and drops its reminders from the list', async () => {
    fakes.reminders.reminders = [LEAVE, CHECK_OUT]
    const { click, rows } = await render()

    await click('settings.reminders.leaveAt')

    expect(rows().map((row) => row.getAttribute('data-kind'))).toEqual(['check_out'])
  })

  it('no upcoming reminder shows the empty state', async () => {
    const { find, rows } = await render()

    expect(rows()).toEqual([])
    expect(find('settings.reminders.upcoming.empty')!.textContent).toContain(
      copy.reminders.upcomingEmptyTitle
    )
  })

  it('a failed save keeps the switch where it was and shows the error', async () => {
    const { click, checked, find } = await render()
    fakes.reminders.failWith = new ApiFailure({ kind: 'network', message: 'down' })

    await click('settings.reminders.tasksDue')

    expect(checked('settings.reminders.tasksDue')).toBe('true')
    expect(find('settings.reminders.error')!.textContent).toContain(copy.errors.network)
  })

  it('offline shows the last loaded values read-only with a hint, and asks the server nothing', async () => {
    const meta = TestBed.inject(MetaStore)
    await meta.set(META_REMINDER_SETTINGS, OFF_LEAVE)
    await meta.set(META_UPCOMING_REMINDERS, [LEAVE])
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const { find, checked, disabled, rows, click } = await render()

    expect(find('settings.reminders.offline')!.textContent).toContain(copy.reminders.offline)
    expect(checked('settings.reminders.leaveAt')).toBe('false')
    expect(disabled('settings.reminders.leaveAt')).toBe(true)
    expect(find<HTMLInputElement>('settings.reminders.quietStart')!.disabled).toBe(true)
    expect(disabled('settings.reminders.saveQuiet')).toBe(true)
    expect(rows()).toHaveLength(1)

    await click('settings.reminders.checkOut')
    expect(fakes.reminders.calls).toEqual([])
  })

  it('offline before anything was ever loaded explains instead of crashing', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const { find } = await render()

    expect(find('settings.reminders.offline')!.textContent).toContain(copy.reminders.notLoaded)
    expect(find('settings.reminders.leaveAt')).toBeNull()
    expect(fakes.reminders.calls).toEqual([])
  })

  it('what the server answered stays on the device for the next offline visit', async () => {
    fakes.reminders.saved = { ...OFF_LEAVE }
    fakes.reminders.reminders = [CHECK_OUT]
    await render()

    const meta = TestBed.inject(MetaStore)
    expect(await meta.get(META_REMINDER_SETTINGS)).toEqual(OFF_LEAVE)
    expect(await meta.get(META_UPCOMING_REMINDERS)).toEqual([CHECK_OUT])
  })
})
