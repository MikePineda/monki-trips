import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { DEMO_TRIP_RECORD, blankEvent } from '../../../testing/fake-trip-content'
import { documentRow } from '../../../testing/fake-documents-api'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { toDocumentRecord } from '../../core/offline/document-record'
import { toEventRecord } from '../../core/offline/event-record'
import { TIME_ZONE } from '../../core/offline/time-zone'
import DocsPage from './docs.page'

describe('DocsPage', () => {
  let db: MonkiTripsDb

  beforeEach(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [DocsPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, clock: new TestClock('2027-01-21T12:00:00.000Z') }),
        { provide: TIME_ZONE, useValue: 'UTC' },
        provideRouter([]),
      ],
    })
    await db.trips.put(DEMO_TRIP_RECORD)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(DocsPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
      rowIds: (group: string) =>
        [
          ...host.querySelectorAll<HTMLElement>(
            `[data-testid="docs.group.${group}"] [data-doc-id]`
          ),
        ].map((row) => row.dataset['docId']),
      until: (check: () => void) =>
        vi.waitFor(() => {
          fixture.detectChanges()
          check()
        }),
    }
  }

  async function seed() {
    await db.events.bulkPut([
      toEventRecord(
        blankEvent({ id: 'ferry', title: 'Ferry to Aldermoor', startsOn: '2027-01-21' })
      ),
      toEventRecord(blankEvent({ id: 'museum', title: 'Museum', startsOn: '2027-01-23' })),
    ])
    await db.docs.bulkPut([
      toDocumentRecord(
        documentRow({
          id: 'voucher',
          eventId: 'ferry',
          title: 'Ferry voucher',
          tags: ['print'],
          sha256: 'aaa',
          sizeBytes: 24_576,
        })
      ),
      toDocumentRecord(
        documentRow({
          id: 'tickets',
          eventId: 'museum',
          title: 'Museum tickets',
          tags: ['show_on_phone'],
          sha256: 'bbb',
        })
      ),
      toDocumentRecord(
        documentRow({
          id: 'passport',
          title: 'Passport scan',
          tags: ['requires_passport'],
          sha256: 'ccc',
        })
      ),
      toDocumentRecord(
        documentRow({
          id: 'link',
          kind: 'link',
          url: 'https://example.com/x',
          title: 'Booking page',
          mime: null,
          sizeBytes: null,
        })
      ),
    ])
    await db.docBlobs.bulkPut([
      {
        docId: 'voucher',
        sha256: 'aaa',
        size: 1,
        mime: 'application/pdf',
        blob: new Blob(['x']),
        savedAt: '2027-01-20T00:00:00Z',
      },
      {
        docId: 'tickets',
        sha256: 'stale',
        size: 1,
        mime: 'application/pdf',
        blob: new Blob(['y']),
        savedAt: '2027-01-20T00:00:00Z',
      },
    ])
  }

  it('honest empty state: upload your passport first', async () => {
    const { has, until } = await render()

    await until(() => expect(has('docs.empty')).toBe(true))
    expect(has('docs.empty.add')).toBe(true)
    expect(has('docs.print')).toBe(false)
  })

  it('groups documents by their event: today, upcoming, other', async () => {
    await seed()
    const { rowIds, until } = await render()

    await until(() => expect(rowIds('today')).toEqual(['voucher']))
    expect(rowIds('upcoming')).toEqual(['tickets'])
    expect(rowIds('other')).toEqual(['link', 'passport'])
  })

  it('each row shows its event, size, tags and offline state', async () => {
    await seed()
    const { host, until } = await render()
    const row = (id: string) => host.querySelector<HTMLElement>(`[data-doc-id="${id}"]`)!

    await until(() => expect(row('voucher')?.dataset['offline']).toBe('saved'))
    expect(row('voucher').textContent).toContain('Ferry to Aldermoor · 24 kB')
    expect(row('voucher').textContent).toContain('Print')
    expect(row('voucher').dataset['offline']).toBe('saved')
    expect(row('voucher').textContent).toContain('Saved offline')
    expect(row('tickets').dataset['offline']).toBe('mismatch')
    expect(row('tickets').textContent).toContain('Hash mismatch')
    expect(row('passport').dataset['offline']).toBe('not_saved')
    expect(row('passport').textContent).toContain('Whole trip')
    expect(row('link').dataset['offline']).toBe('link')
  })

  it('a document tagged print raises the full-width print band', async () => {
    await seed()
    const { host, until } = await render()

    await until(() => expect(host.querySelector('[data-testid="docs.print"]')).not.toBeNull())
    const band = host.querySelector<HTMLElement>('[data-testid="docs.print"]')!
    expect(band.dataset['tone']).toBe('print')
    expect(band.textContent).toContain('Bring this printed')
    expect(band.textContent).toContain('Ferry voucher')
  })

  it('filters by tag', async () => {
    await seed()
    const { host, rowIds, until, fixture } = await render()
    await until(() => expect(rowIds('today')).toEqual(['voucher']))

    host
      .querySelector<HTMLButtonElement>('[data-testid="docs.filter.requires_passport"] button')!
      .click()
    await settle(fixture)

    await until(() => expect(rowIds('other')).toEqual(['passport']))
    expect(rowIds('today')).toEqual([])
    host.querySelector<HTMLButtonElement>('[data-testid="docs.filter.all"] button')!.click()
    await until(() => expect(rowIds('today')).toEqual(['voucher']))
  })
})
