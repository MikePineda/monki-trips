import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import type { AiAction, AiBookingProposal, BookingDraft } from '@monkitrips/shared'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import { ApiFailure } from '../../core/api/api-failure'
import type { MonkiTripsDb } from '../../core/offline/db'
import { SyncService } from '../../core/offline/sync.service'
import { BOOKING_EXTRACTION_API, type BookingExtractionApi } from './booking-extraction-api'
import {
  BookingReviewSheet,
  type BookingReviewData,
  type BookingReviewResult,
} from './booking-review.sheet'

const DRAFT: BookingDraft = {
  kind: 'ferry',
  title: 'Ferry to the island',
  providerName: 'Example Ferries',
  bookingCode: 'TEST01',
  segments: [
    {
      carrier: 'Example Ferries',
      number: 'EF 12',
      originName: 'North Harbour',
      originCode: null,
      destName: 'South Island',
      destCode: null,
      departsLocal: '2027-01-22T08:30',
      departsTz: 'Asia/Tokyo',
      arrivesLocal: '2027-01-22T10:15',
      arrivesTz: 'Asia/Tokyo',
    },
  ],
  startsLocal: null,
  startTz: null,
  endsLocal: null,
  endTz: null,
  placeName: null,
  address: null,
  addressLocal: null,
  cost: '45.00',
  costCurrency: 'EUR',
  seats: [{ segment: 0, seat: '12A', coach: null }],
}

function bookingAction(overrides: Partial<AiBookingProposal> = {}): AiAction {
  const proposal: AiBookingProposal = {
    kind: 'booking',
    documentId: 'voucher',
    eventId: 'ev-new',
    source: 'text',
    draft: DRAFT,
    review: [
      { field: 'segments.0.departsTz', reason: 'low_confidence' },
      { field: 'bookingCode', reason: 'needs_review' },
      { field: 'segments.0.originCode', reason: 'missing' },
    ],
    changes: {
      kind: 'event_changes',
      summary: null,
      events: [],
      nights: [],
      uncoveredBefore: 0,
      uncoveredAfter: 0,
    },
    ...overrides,
  }
  return {
    id: 'act-1',
    tripId: 'trip-1',
    conversationId: null,
    messageId: null,
    tool: 'extract_booking',
    status: 'proposed',
    proposal,
    expiresAt: '2026-11-08T12:00:00.000Z',
    decidedAt: null,
    errorCode: null,
    createdAt: '2026-11-07T12:00:00.000Z',
  }
}

/** Records every call and answers what the spec queued. */
class RecordingExtractionApi implements BookingExtractionApi {
  calls: string[] = []
  revisedWith: BookingDraft[] = []
  reviseFailure: ApiFailure | null = null

  extract(): Promise<AiAction> {
    this.calls.push('extract')
    return Promise.resolve(bookingAction())
  }

  revise(_tripId: string, _actionId: string, draft: BookingDraft): Promise<AiAction> {
    this.calls.push('revise')
    this.revisedWith.push(draft)
    if (this.reviseFailure) {
      return Promise.reject(this.reviseFailure)
    }
    return Promise.resolve(bookingAction({ draft, review: [] }))
  }

  accept(): Promise<AiAction> {
    this.calls.push('accept')
    return Promise.resolve({ ...bookingAction(), status: 'accepted' })
  }

  reject(): Promise<AiAction> {
    this.calls.push('reject')
    return Promise.resolve({ ...bookingAction(), status: 'rejected' })
  }
}

describe('BookingReviewSheet', () => {
  let db: MonkiTripsDb
  let api: RecordingExtractionApi
  let closedWith: BookingReviewResult[]

  function setup(action: AiAction = bookingAction(), online = true) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
    db = freshOfflineDb()
    api = new RecordingExtractionApi()
    closedWith = []
    TestBed.configureTestingModule({
      imports: [BookingReviewSheet, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        { provide: BOOKING_EXTRACTION_API, useValue: api },
        {
          provide: DIALOG_DATA,
          useValue: { tripId: 'trip-1', action } satisfies BookingReviewData,
        },
        {
          provide: DialogRef,
          useValue: { close: (result: BookingReviewResult) => closedWith.push(result) },
        },
      ],
    })
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(BookingReviewSheet)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const find = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const click = async (id: string) => {
      find(id)!.click()
      await settle(fixture)
    }
    const until = (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    return { fixture, host, find, click, until }
  }

  it('review sheet flags low-confidence and needs-review fields with an icon and a label', async () => {
    setup()
    const { find } = await render()

    const zone = find('docs.review.flag.segments.0.departsTz')!
    expect(zone.textContent?.trim()).toBe('Not sure')
    expect(zone.querySelector('mk-icon')).not.toBeNull()
    expect(zone.getAttribute('data-reason')).toBe('low_confidence')

    const code = find('docs.review.flag.bookingCode')!
    expect(code.textContent?.trim()).toBe('Check this')
    expect(code.querySelector('mk-icon')).not.toBeNull()

    expect(find('docs.review.flag.segments.0.originCode')?.textContent?.trim()).toBe('Missing')
    expect(find('docs.review.flag.title')).toBeNull()
    expect((find('docs.review.field.segments.0.departsTz') as HTMLInputElement).value).toBe(
      'Asia/Tokyo'
    )
    expect((find('docs.review.field.segments.0.departsLocal') as HTMLInputElement).type).toBe(
      'datetime-local'
    )
    expect((find('docs.review.field.seats.0.seat') as HTMLInputElement).value).toBe('12A')
  })

  it('review sheet sends a revise before accepting when a field was edited', async () => {
    setup()
    const requestSync = vi.spyOn(TestBed.inject(SyncService), 'requestSync')
    const { find, click, until } = await render()

    typeInto(
      find('docs.review.field.segments.0.departsLocal') as HTMLInputElement,
      '2027-01-22T09:00'
    )
    await click('docs.review.accept')

    await until(() => expect(closedWith).toHaveLength(1))
    expect(api.calls).toEqual(['revise', 'accept'])
    expect(api.revisedWith[0].segments[0].departsLocal).toBe('2027-01-22T09:00')
    expect(api.revisedWith[0].title).toBe('Ferry to the island')
    expect(closedWith[0]?.action.status).toBe('accepted')
    expect(requestSync).toHaveBeenCalled()
  })

  it('review sheet accepts directly when nothing changed', async () => {
    setup()
    const { click, until } = await render()

    await click('docs.review.accept')

    await until(() => expect(closedWith).toHaveLength(1))
    expect(api.calls).toEqual(['accept'])
  })

  it('a field the server rejects on revise shows its message next to the field', async () => {
    setup()
    const { find, click, until, host } = await render()
    api.reviseFailure = new ApiFailure({
      kind: 'http',
      status: 422,
      code: 'E_VALIDATION_ERROR',
      message: 'Some fields are not valid',
      fields: [
        { field: 'draft.segments.0.departsTz', rule: 'timezone', message: 'Not a time zone' },
      ],
    })

    typeInto(find('docs.review.field.segments.0.departsTz') as HTMLInputElement, 'Mars/Base')
    await click('docs.review.accept')

    await until(() => expect(host.textContent).toContain('Not a time zone'))
    const field = find('docs.review.field.segments.0.departsTz')!.closest('mk-field')!
    expect(field.textContent).toContain('Not a time zone')
    expect(api.calls).toEqual(['revise'])
    expect(closedWith).toEqual([])
  })

  it('reject discards the proposal without writing anything', async () => {
    setup()
    const { click, until } = await render()

    await click('docs.review.reject')

    await until(() => expect(closedWith).toHaveLength(1))
    expect(api.calls).toEqual(['reject'])
    expect(await db.outbox.count()).toBe(0)
  })

  it('shows one line per night the booking changes', async () => {
    setup(
      bookingAction({
        changes: {
          kind: 'event_changes',
          summary: null,
          events: [],
          nights: [
            {
              date: '2027-01-22',
              before: null,
              after: { eventId: 'ev-new', title: 'Harbour Inn' },
            },
          ],
          uncoveredBefore: 1,
          uncoveredAfter: 0,
        },
      })
    )
    const { host } = await render()

    const lines = [...host.querySelectorAll('[data-testid="docs.review.night"]')]
    expect(lines).toHaveLength(1)
    expect(lines[0].textContent).toContain('no bed → Harbour Inn')
  })

  it('offline the decisions are disabled with a reason', async () => {
    setup(bookingAction(), false)
    const { find } = await render()

    expect(find('docs.review.offline')).not.toBeNull()
    expect(find('docs.review.accept')?.hasAttribute('disabled')).toBe(true)
    expect(find('docs.review.reject')?.hasAttribute('disabled')).toBe(true)
  })
})
