import { test } from '@japa/runner'
import type { TripNight } from '@monkitrips/shared'
import { shiftedEnd } from '#domain/event_move'
import { nightShifts } from '#domain/night_shifts'
import { clipText } from '#domain/clip_text'

function night(date: string, cover: { eventId: string; title: string } | null): TripNight {
  return {
    date,
    covered: cover !== null,
    coveredBy: cover ? { ...cover, kind: 'lodging' } : null,
  }
}

const hotel = { eventId: 'e-hotel', title: 'Beach hotel' }
const train = { eventId: 'e-train', title: 'Night train' }

test.group('Assistant proposals', () => {
  test('moving the start keeps the duration in wall-clock time', ({ assert }) => {
    assert.equal(
      shiftedEnd('2027-01-24T14:00:00', '2027-01-26T11:00:00', '2027-01-25T14:00:00'),
      '2027-01-27T11:00:00'
    )
    assert.equal(
      shiftedEnd('2027-01-24T23:30:00', '2027-01-25T01:00:00', '2027-01-24T22:00'),
      '2027-01-24T23:30:00'
    )
  })

  test('an event without an end or start has nothing to shift', ({ assert }) => {
    assert.isNull(shiftedEnd(null, '2027-01-26T11:00:00', '2027-01-25T14:00:00'))
    assert.isNull(shiftedEnd('2027-01-24T14:00:00', null, '2027-01-25T14:00:00'))
    assert.isNull(shiftedEnd('2027-01-24T14:00:00', '2027-01-26T11:00:00', 'not a time'))
  })

  test('night shifts list only the nights whose cover changes', ({ assert }) => {
    const before = [
      night('2027-01-24', hotel),
      night('2027-01-25', hotel),
      night('2027-01-26', null),
    ]
    const after = [
      night('2027-01-24', null),
      night('2027-01-25', hotel),
      night('2027-01-26', hotel),
    ]

    assert.deepEqual(nightShifts(before, after), [
      { date: '2027-01-24', before: hotel, after: null },
      { date: '2027-01-26', before: null, after: hotel },
    ])
  })

  test('a night that changes from one cover to another is a shift', ({ assert }) => {
    assert.deepEqual(nightShifts([night('2027-01-24', hotel)], [night('2027-01-24', train)]), [
      { date: '2027-01-24', before: hotel, after: train },
    ])
    assert.deepEqual(nightShifts([night('2027-01-24', hotel)], [night('2027-01-24', hotel)]), [])
  })
})

test.group('Clip text', () => {
  test('long text is cut with an ellipsis and never exceeds the limit', ({ assert }) => {
    const clipped = clipText('Bring cash for the boat. '.repeat(20), 30)!
    assert.isAtMost([...clipped].length, 30)
    assert.isTrue(clipped.endsWith('...'))
  })

  test('short text and null are kept as they are', ({ assert }) => {
    assert.equal(clipText('Pier 3', 30), 'Pier 3')
    assert.isNull(clipText(null, 30))
  })

  test('characters outside the basic plane are never split', ({ assert }) => {
    assert.equal(clipText('🌴🌴🌴🌴🌴🌴', 5), '🌴🌴...')
  })
})
