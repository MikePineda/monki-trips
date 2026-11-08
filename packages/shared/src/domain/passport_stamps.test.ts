import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arrivalMode, passportStamps, type PassportInput } from './passport_stamps.ts'

const PAST = { id: 'past', name: 'Island hop', startsOn: '2026-05-01', endsOn: '2026-05-10' }
const NOW = { id: 'now', name: 'Long loop', startsOn: '2026-11-01', endsOn: '2026-11-20' }
const NEXT = { id: 'next', name: 'Snow week', startsOn: '2027-02-01', endsOn: '2027-02-07' }

function stop(
  id: string,
  tripId: string,
  position: number,
  name: string,
  countryCode: string | null,
  arriveOn: string | null,
  departOn: string | null
) {
  return { id, tripId, position, name, countryCode, arriveOn, departOn }
}

function input(overrides: Partial<PassportInput> = {}): PassportInput {
  return { trips: [PAST, NOW, NEXT], stops: [], arrivals: [], today: '2026-11-08', ...overrides }
}

test('a city counts once its stop is past', () => {
  const stamps = passportStamps(
    input({
      stops: [
        stop('a', 'now', 0, 'Harbour City', 'XA', '2026-11-01', '2026-11-05'),
        stop('b', 'now', 1, 'Old Town', 'XA', '2026-11-05', '2026-11-08'),
        stop('c', 'now', 2, 'Hill Fort', 'XB', '2026-11-08', '2026-11-20'),
      ],
    })
  )
  const xa = stamps.find((stamp) => stamp.code === 'XA')!
  const xb = stamps.find((stamp) => stamp.code === 'XB')!

  assert.deepEqual(
    xa.cities.map((city) => [city.name, city.earned]),
    [
      ['Harbour City', true],
      ['Old Town', false],
    ],
    'leaving today is not past yet'
  )
  assert.equal(xa.earned, true)
  assert.equal(xb.earned, false, 'a country with no past stop is still coming up')
  assert.equal(xb.cities[0].earned, false)
})

test('every stop of a past trip counts, even without a departure date', () => {
  const [xa] = passportStamps(
    input({ stops: [stop('a', 'past', 0, 'Harbour City', 'XA', null, null)] })
  )

  assert.equal(xa.earned, true)
  assert.equal(xa.cities[0].earned, true)
  assert.equal(xa.date, '2026-05-01', 'undated stops take the first day of their trip')
  assert.equal(xa.tripId, 'past')
  assert.equal(xa.tripName, 'Island hop')
})

test('a place counts once: the first earned visit is its stamp', () => {
  const [xa] = passportStamps(
    input({
      stops: [
        stop('a2', 'now', 0, 'harbour city ', 'XA', '2026-11-01', '2026-11-04'),
        stop('a1', 'past', 0, 'Harbour City', 'XA', '2026-05-02', '2026-05-06'),
        stop('a3', 'next', 0, 'Harbour City', 'XA', '2027-02-01', '2027-02-07'),
      ],
    })
  )

  assert.equal(xa.cities.length, 1)
  assert.equal(xa.cities[0].name, 'Harbour City')
  assert.equal(xa.cities[0].date, '2026-05-02')
  assert.equal(xa.cities[0].tripId, 'past')
  assert.deepEqual(
    xa.cities[0].visits.map((visit) => [visit.tripId, visit.earned]),
    [
      ['past', true],
      ['now', true],
      ['next', false],
    ]
  )
})

test('an upcoming place carries its first planned visit', () => {
  const [xc] = passportStamps(
    input({ stops: [stop('c', 'next', 0, 'Snow Peak', 'XC', '2027-02-02', '2027-02-07')] })
  )

  assert.equal(xc.earned, false)
  assert.equal(xc.date, '2027-02-02')
  assert.equal(xc.tripId, 'next')
})

test('countries follow the order they were first visited, earned before coming up', () => {
  const stamps = passportStamps(
    input({
      stops: [
        stop('n', 'next', 0, 'Snow Peak', 'XC', '2027-02-01', '2027-02-07'),
        stop('b', 'now', 0, 'Old Town', 'XB', '2026-11-01', '2026-11-04'),
        stop('a', 'past', 0, 'Harbour City', 'XA', '2026-05-01', '2026-05-10'),
      ],
    })
  )
  assert.deepEqual(
    stamps.map((stamp) => stamp.code),
    ['XA', 'XB', 'XC']
  )
})

test('stops without a country or a name are left out', () => {
  const stamps = passportStamps(
    input({
      stops: [
        stop('a', 'past', 0, 'Nowhere', null, '2026-05-01', '2026-05-02'),
        stop('b', 'past', 1, '  ', 'XA', '2026-05-02', '2026-05-03'),
      ],
    })
  )
  assert.deepEqual(stamps, [])
})

test('stops of a trip the device no longer has are ignored', () => {
  const stamps = passportStamps(
    input({ stops: [stop('a', 'gone', 0, 'Harbour City', 'XA', '2026-05-01', '2026-05-02')] })
  )
  assert.deepEqual(stamps, [])
})

test('the way in is the transport that arrives the day the stop starts', () => {
  const stamps = passportStamps(
    input({
      stops: [
        stop('a', 'past', 0, 'Harbour City', 'XA', '2026-05-01', '2026-05-05'),
        stop('b', 'past', 1, 'Old Town', 'XB', '2026-05-05', '2026-05-10'),
      ],
      arrivals: [
        { tripId: 'past', kind: 'flight', status: 'booked', arrivesOn: '2026-05-01' },
        { tripId: 'past', kind: 'ferry', status: 'cancelled', arrivesOn: '2026-05-05' },
        { tripId: 'past', kind: 'train', status: 'paid', arrivesOn: '2026-05-05' },
      ],
    })
  )
  assert.equal(stamps[0].arrivedBy, 'plane')
  assert.equal(stamps[1].arrivedBy, 'train', 'a cancelled ferry did not take us there')
  assert.equal(stamps[1].cities[0].arrivedBy, 'train')
})

test('transport kinds map to the three stamp icons and the road', () => {
  assert.equal(arrivalMode('flight'), 'plane')
  assert.equal(arrivalMode('train'), 'train')
  assert.equal(arrivalMode('ferry'), 'boat')
  assert.equal(arrivalMode('bus'), 'road')
  assert.equal(arrivalMode('car'), 'road')
  assert.equal(arrivalMode('lodging'), null)
})

test('stamps carry the stop coordinates for the map when known', () => {
  const [xa] = passportStamps(
    input({
      stops: [
        {
          ...stop('a', 'past', 0, 'Harbour City', 'XA', '2026-05-01', '2026-05-05'),
          lat: 12.5,
          lng: -3.25,
        },
      ],
    })
  )
  assert.deepEqual(xa.cities[0].coordinates, { lat: 12.5, lng: -3.25 })
})
