import { test } from '@japa/runner'
import { nightCoverage, nightsOf, type NightEvent } from '#domain/night_coverage'

const TRIP = { startsOn: '2027-01-20', endsOn: '2027-01-24', homeTz: 'Australia/Sydney' }

function event(overrides: Partial<NightEvent> & Pick<NightEvent, 'id' | 'kind'>): NightEvent {
  return {
    status: 'booked',
    title: overrides.id,
    startsOn: null,
    endsOn: null,
    startsAt: null,
    endsAt: null,
    startTz: null,
    coversNight: null,
    ...overrides,
  }
}

const hotel = event({
  id: 'hotel',
  kind: 'lodging',
  startsOn: '2027-01-20',
  endsOn: '2027-01-22',
})

test.group('Night coverage', () => {
  test('a trip has one night per day except the last', ({ assert }) => {
    assert.deepEqual(nightsOf('2027-01-20', '2027-01-24'), [
      '2027-01-20',
      '2027-01-21',
      '2027-01-22',
      '2027-01-23',
    ])
    assert.deepEqual(nightsOf('2027-01-20', '2027-01-20'), [])
  })

  test('night with no lodging raises an alert', ({ assert }) => {
    const nights = nightCoverage({ ...TRIP, events: [hotel] })

    assert.deepEqual(
      nights.map((night) => [night.date, night.covered]),
      [
        ['2027-01-20', true],
        ['2027-01-21', true],
        ['2027-01-22', false],
        ['2027-01-23', false],
      ]
    )
    assert.equal(nights[0].coveredBy?.eventId, 'hotel')
  })

  test('overnight train covers the night', ({ assert }) => {
    const train = event({
      id: 'night-train',
      kind: 'train',
      startTz: 'Asia/Bangkok',
      // Departs 22:00 local on the 22nd, arrives 08:00 on the 23rd.
      startsAt: '2027-01-22T15:00:00.000Z',
      endsAt: '2027-01-23T01:00:00.000Z',
    })

    const nights = nightCoverage({ ...TRIP, events: [hotel, train] })

    assert.equal(nights[2].covered, true)
    assert.deepEqual(nights[2].coveredBy, {
      eventId: 'night-train',
      kind: 'train',
      title: 'night-train',
    })
    assert.equal(nights[3].covered, false)
  })

  test('final night on a plane counts as covered', ({ assert }) => {
    const flight = event({
      id: 'home-flight',
      kind: 'flight',
      startTz: 'Asia/Tokyo',
      // Departs 23:30 local on the 23rd, lands the next morning.
      startsAt: '2027-01-23T14:30:00.000Z',
      endsAt: '2027-01-24T00:30:00.000Z',
    })

    const nights = nightCoverage({ ...TRIP, events: [flight] })

    assert.equal(nights[3].covered, true)
    assert.equal(nights[3].coveredBy?.kind, 'flight')
  })

  test('late flight landing at 02:00 leaves the night uncovered', ({ assert }) => {
    const flight = event({
      id: 'late-flight',
      kind: 'flight',
      startTz: 'Asia/Tokyo',
      // Departs 23:00, lands 02:00 the next day in the same zone.
      startsAt: '2027-01-23T14:00:00.000Z',
      endsAt: '2027-01-23T17:00:00.000Z',
    })

    const nights = nightCoverage({ ...TRIP, events: [flight] })

    assert.equal(nights[3].covered, false)
  })

  test('cancelled lodging and ideas never cover a night', ({ assert }) => {
    const cancelled = { ...hotel, id: 'cancelled', status: 'cancelled' as const }
    const idea = { ...hotel, id: 'idea', status: 'idea' as const }

    const nights = nightCoverage({ ...TRIP, events: [cancelled, idea] })

    assert.isTrue(nights.every((night) => !night.covered))
  })

  test('a night covered by a hotel and a train at once is counted once, hotel first', ({
    assert,
  }) => {
    const train = event({
      id: 'train',
      kind: 'train',
      startTz: 'Australia/Sydney',
      startsAt: '2027-01-20T11:00:00.000Z',
      endsAt: '2027-01-20T21:00:00.000Z',
    })

    const nights = nightCoverage({ ...TRIP, events: [train, hotel] })

    assert.equal(nights.filter((night) => night.covered).length, 2)
    assert.equal(nights[0].coveredBy?.eventId, 'hotel')
  })

  test('covers night forces the answer either way', ({ assert }) => {
    const earlyFlight = event({
      id: 'forced',
      kind: 'bus',
      startTz: 'Australia/Sydney',
      startsAt: '2027-01-22T20:00:00.000Z',
      endsAt: '2027-01-22T22:00:00.000Z',
      coversNight: true,
    })
    const hotelOff = { ...hotel, coversNight: false }

    const nights = nightCoverage({ ...TRIP, events: [earlyFlight, hotelOff] })

    assert.equal(nights[0].covered, false)
    assert.equal(nights[3].covered, true)
  })
})
