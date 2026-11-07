import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { outboxMutation } from '../../core/offline/mutation'
import EmergencyPage from './emergency.page'

describe('EmergencyPage', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [EmergencyPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), provideRouter([])],
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(EmergencyPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      hrefs: () =>
        [...host.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]')].map((link) =>
          link.getAttribute('href')
        ),
      fill: (id: string, value: string) =>
        typeInto(host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!, value),
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
      settle: () => settle(fixture),
      until: (check: () => void) =>
        vi.waitFor(() => {
          fixture.detectChanges()
          check()
        }),
    }
  }

  it('phone numbers render as tel links from the device copy', async () => {
    await db.emergency.put({
      id: 'trip-1',
      tripId: 'trip-1',
      content: {
        insurance: { provider: 'Demo Assure', policyNumber: 'DEMO-1', phone: '+1 555 0100' },
        embassy: { name: 'Consulate of Demo', phone: '+1 555 0101', address: '1 Demo Street' },
        contacts: [
          { name: 'Nearest hospital', phone: '+1 555 0102', note: null },
          { name: 'Local emergency number', phone: '112', note: null },
        ],
        medical: { notes: 'Allergic to demo' },
      },
      schemaVersion: 1,
      updatedAt: 'x',
    })
    const { hrefs, host, has, until } = await render()

    await until(() =>
      expect(hrefs()).toEqual(['tel:+15550100', 'tel:+15550101', 'tel:+15550102', 'tel:112'])
    )
    expect(host.textContent).toContain('Policy DEMO-1')
    expect(host.textContent).toContain('Allergic to demo')
    expect(has('emergency.form')).toBe(false)
    expect(has('emergency.edit')).toBe(true)
  })

  it('starts empty with one action, and saving offline queues the changed keys', async () => {
    const { has, click, fill, host, settle, until } = await render()
    await until(() => expect(has('emergency.empty')).toBe(true))

    await click('emergency.add')
    fill('emergency.form.insurer', 'Demo Assure')
    fill('emergency.form.assistancePhone', '+1 555 0100')
    fill('emergency.form.localEmergencyPhone', '112')
    host
      .querySelector<HTMLFormElement>('[data-testid="emergency.form"]')!
      .dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()

    await until(() => expect(has('emergency.form')).toBe(false))
    await until(() =>
      expect(host.querySelector('[data-testid="emergency.read"]')?.getAttribute('data-sync')).toBe(
        'pending'
      )
    )
    expect(host.textContent).toContain('Local emergency number')
    const queued = (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({
      entity: 'emergency',
      id: 'trip-1',
      changes: {
        insurance: { provider: 'Demo Assure', policyNumber: null, phone: '+1 555 0100' },
        contacts: [{ name: 'Local emergency number', phone: '112', note: null }],
      },
    })
    expect(Object.keys(queued[0]!.changes).sort()).toEqual(['contacts', 'insurance'])
  })
})
