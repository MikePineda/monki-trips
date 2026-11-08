import { test } from '@japa/runner'
import type { BookingDraft } from '@monkitrips/shared'
import { bookingMutations } from '#services/assistant/extraction/booking_mutations'
import { emptySegment, normalizeDraft } from '#services/assistant/extraction/booking_draft_rules'

const TRIP = '00000000-0000-4000-8000-000000000001'
const EVENT = '00000000-0000-4000-8000-0000000000e1'
const DOCUMENT = '00000000-0000-4000-8000-0000000000d1'

function ids() {
  let n = 0
  return {
    tripId: TRIP,
    eventId: EVENT,
    documentId: DOCUMENT,
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    changedAt: '2026-11-08T10:00:00.000Z',
    labels: { seats: 'Seats', coach: 'coach' },
  }
}

function draft(overrides: Partial<BookingDraft>): BookingDraft {
  return normalizeDraft({ kind: 'ferry', title: 'Ferry', ...overrides })
}

test.group('Booking mutations', () => {
  test('a transport booking becomes one booked event, its complete legs and the document link', ({
    assert,
  }) => {
    const mutations = bookingMutations(
      draft({
        providerName: 'Example Ferries',
        bookingCode: 'TEST01',
        cost: '1200.50',
        costCurrency: 'THB',
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
          { ...emptySegment(), departsLocal: '2027-01-26T09:00' },
        ],
      }),
      ids()
    )

    assert.deepEqual(
      mutations.map((m) => [m.entity, m.id, m.tripId]),
      [
        ['event', EVENT, TRIP],
        ['segment', '00000000-0000-4000-8000-000000000002', TRIP],
        ['document', DOCUMENT, TRIP],
      ]
    )
    assert.deepEqual(mutations[0].changes, {
      kind: 'ferry',
      title: 'Ferry',
      status: 'booked',
      providerName: 'Example Ferries',
      bookingCode: 'TEST01',
      costMinor: 120050,
      costCurrency: 'THB',
    })
    assert.deepInclude(mutations[1].changes!, {
      eventId: EVENT,
      position: 0,
      originName: 'North Pier',
      departsLocal: '2027-01-25T09:00',
      arrivesTz: 'Asia/Bangkok',
    })
    assert.deepEqual(mutations[2].changes, { eventId: EVENT })
  })

  test('a lodging keeps its check-in and check-out on the event with their zones', ({ assert }) => {
    const [event] = bookingMutations(
      draft({
        kind: 'lodging',
        title: 'Example Guesthouse',
        startsLocal: '2027-01-25T14:00',
        startTz: 'Asia/Bangkok',
        endsLocal: '2027-01-27T11:00',
        address: '1 Example Road',
        addressLocal: 'ถนนตัวอย่าง 1',
      }),
      { ...ids(), documentId: null }
    )

    assert.deepInclude(event.changes!, {
      kind: 'lodging',
      startsLocal: '2027-01-25T14:00',
      startTz: 'Asia/Bangkok',
      endsLocal: '2027-01-27T11:00',
      endTz: 'Asia/Bangkok',
      address: '1 Example Road',
      addressLocal: 'ถนนตัวอย่าง 1',
    })
  })

  test('a time without its zone and an amount without a currency are left out, not guessed', ({
    assert,
  }) => {
    const [event] = bookingMutations(
      draft({ kind: 'tour', startsLocal: '2027-01-25T09:00', cost: '50' }),
      ids()
    )

    assert.notProperty(event.changes!, 'startsLocal')
    assert.notProperty(event.changes!, 'costMinor')
  })

  test('a draft without a title is titled after its provider or its route', ({ assert }) => {
    const [byProvider] = bookingMutations(
      draft({ title: null, providerName: 'Example Rail' }),
      ids()
    )
    const [byRoute] = bookingMutations(
      draft({
        title: null,
        segments: [{ ...emptySegment(), originName: 'A Town', destName: 'B Town' }],
      }),
      ids()
    )

    assert.equal(byProvider.changes!.title, 'Example Rail')
    assert.equal(byRoute.changes!.title, 'A Town → B Town')
  })

  test('seat lines become a note on the event, never a traveller', ({ assert }) => {
    const [event] = bookingMutations(
      draft({
        segments: [{ ...emptySegment(), originName: 'A', destName: 'B' }],
        seats: [
          { segment: 0, seat: '12A', coach: '3' },
          { segment: null, seat: '12B', coach: null },
        ],
      }),
      ids()
    )

    assert.equal(event.changes!.notes, 'Seats: 12A (coach 3), 12B')
  })
})
