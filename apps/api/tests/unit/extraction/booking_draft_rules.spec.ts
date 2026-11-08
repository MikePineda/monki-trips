import { test } from '@japa/runner'
import type { BookingDraft } from '@monkitrips/shared'
import {
  draftProblems,
  draftReviewFlags,
  emptySegment,
  normalizeDraft,
  revisedReviewFlags,
} from '#services/assistant/extraction/booking_draft_rules'

function ferry(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return normalizeDraft({
    kind: 'ferry',
    title: 'Ferry to Example Island',
    providerName: 'Example Ferries',
    bookingCode: 'TEST01',
    segments: [
      {
        ...emptySegment(),
        originName: 'North Pier',
        destName: 'Example Island',
        departsLocal: '2027-01-25T09:00',
        departsTz: 'Asia/Bangkok',
        arrivesLocal: '2027-01-25T11:30',
        arrivesTz: 'Asia/Bangkok',
      },
    ],
    cost: '1200',
    costCurrency: 'THB',
    ...overrides,
  })
}

test.group('Booking draft rules', () => {
  test('a draft the model left partly empty is normalised with nulls, never invented values', ({
    assert,
  }) => {
    const draft = normalizeDraft({
      kind: 'lodging',
      segments: [{ departsLocal: '2027-01-25T09:00:00' }],
    })

    assert.equal(draft.title, null)
    assert.equal(draft.startTz, null)
    assert.deepEqual(draft.seats, [])
    assert.equal(draft.segments[0].departsLocal, '2027-01-25T09:00')
    assert.equal(draft.segments[0].departsTz, null)
  })

  test('unknown fields stay null and are flagged as missing or needing review', ({ assert }) => {
    const draft = ferry({
      title: null,
      segments: [{ ...emptySegment(), departsLocal: '2027-01-25T09:00' }],
    })

    const flags = draftReviewFlags(draft, {})

    assert.deepInclude(flags, { field: 'title', reason: 'missing' })
    assert.deepInclude(flags, { field: 'segments.0.departsTz', reason: 'needs_review' })
    assert.deepInclude(flags, { field: 'segments.0.arrivesLocal', reason: 'missing' })
  })

  test('the model flags are kept only for fields the draft has', ({ assert }) => {
    const flags = draftReviewFlags(ferry(), {
      needsReview: ['segments.0.departsTz', 'tripId', 'segments.7.departsTz'],
      lowConfidence: ['cost'],
    })

    assert.deepEqual(flags, [
      { field: 'segments.0.departsTz', reason: 'needs_review' },
      { field: 'cost', reason: 'low_confidence' },
    ])
  })

  test('a lodging without a check-in is flagged missing', ({ assert }) => {
    const flags = draftReviewFlags(normalizeDraft({ kind: 'lodging', title: 'Hotel' }), {})

    assert.deepInclude(flags, { field: 'startsLocal', reason: 'missing' })
  })

  test('problems name the field path and rule of zones, times, order and amounts', ({ assert }) => {
    const problems = draftProblems(
      ferry({
        cost: '12.345',
        segments: [
          {
            ...emptySegment(),
            departsLocal: '2027-01-25T11:00',
            departsTz: 'Mars/Olympus',
            arrivesLocal: '2027-01-25T09:00',
            arrivesTz: 'Asia/Bangkok',
          },
          {
            ...emptySegment(),
            departsLocal: '2027-01-26T12:00',
            departsTz: 'Asia/Bangkok',
            arrivesLocal: '2027-01-26T10:00',
            arrivesTz: 'Asia/Bangkok',
          },
        ],
        seats: [{ segment: 4, seat: '12A', coach: null }],
      })
    )

    assert.deepEqual(problems, [
      { field: 'segments.0.departsTz', rule: 'timezone' },
      { field: 'segments.1.arrivesLocal', rule: 'afterOrEqual' },
      { field: 'cost', rule: 'amount' },
      { field: 'seats.0.segment', rule: 'range' },
    ])
  })

  test('a local time that does not exist in its zone is a problem', ({ assert }) => {
    const problems = draftProblems(
      normalizeDraft({
        kind: 'tour',
        title: 'Walk',
        startsLocal: '2027-03-14T02:30',
        startTz: 'America/New_York',
      })
    )

    assert.deepEqual(problems, [{ field: 'startsLocal', rule: 'nonexistentLocalTime' }])
  })

  test('a valid draft has no problems', ({ assert }) => {
    assert.deepEqual(draftProblems(ferry()), [])
  })

  test('a revision drops the flags of fields the member changed and recomputes missing ones', ({
    assert,
  }) => {
    const before = ferry({ segments: [{ ...emptySegment(), departsLocal: '2027-01-25T09:00' }] })
    const flags = [
      { field: 'segments.0.departsTz', reason: 'needs_review' as const },
      { field: 'cost', reason: 'low_confidence' as const },
    ]
    const after = ferry({
      segments: [
        {
          ...emptySegment(),
          departsLocal: '2027-01-25T09:00',
          departsTz: 'Asia/Bangkok',
          arrivesLocal: '2027-01-25T11:00',
          arrivesTz: 'Asia/Bangkok',
        },
      ],
    })

    assert.deepEqual(revisedReviewFlags(before, flags, after), [
      { field: 'cost', reason: 'low_confidence' },
    ])
  })
})
