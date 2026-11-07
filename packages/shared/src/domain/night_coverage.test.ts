import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNightTransport, nightCoverage, windowCoversNight } from './night_coverage.ts'
import type { TripEvent } from './trip_event.ts'
import { zonedFromLocal } from './zoned_instant.ts'

// A synthetic twelve-day loop; offsets stand for invented zones.
const trip = { startsOn: '2026-01-10', endsOn: '2026-01-21' }

function event(partial: Partial<TripEvent> & Pick<TripEvent, 'id' | 'kind' | 'starts'>): TripEvent {
  return { status: 'booked', title: partial.id, ends: null, ...partial }
}

const hotel = event({
  id: 'hotel-a',
  kind: 'lodging',
  starts: zonedFromLocal('2026-01-10T15:00', 60),
  ends: zonedFromLocal('2026-01-12T11:00', 60),
})

test('overnight train covers the night', () => {
  const train = event({
    id: 'night-train',
    kind: 'train',
    starts: zonedFromLocal('2026-01-12T22:00', 60),
    ends: zonedFromLocal('2026-01-13T07:30', 60),
  })
  const report = nightCoverage(trip, [hotel, train])
  const night = report.nights.find((n) => n.date === '2026-01-12')
  assert.equal(night?.covered, true)
  assert.deepEqual(night?.coveredBy, [
    { eventId: 'night-train', kind: 'train', how: 'transport', segmentId: undefined },
  ])
})

test('final night on a plane counts as covered', () => {
  const flight = event({
    id: 'home-flight',
    kind: 'flight',
    starts: zonedFromLocal('2026-01-20T23:00', 600),
    ends: zonedFromLocal('2026-01-21T10:00', -600),
  })
  const report = nightCoverage(trip, [flight])
  assert.equal(report.nights.at(-1)?.date, '2026-01-20')
  assert.equal(report.nights.at(-1)?.covered, true)
  assert.equal(report.uncovered.includes('2026-01-20'), false)
})

test('late flight landing at 02:00 leaves the night uncovered', () => {
  const flight = event({
    id: 'late-flight',
    kind: 'flight',
    starts: zonedFromLocal('2026-01-14T23:00', 60),
    ends: zonedFromLocal('2026-01-15T02:00', 60),
  })
  const report = nightCoverage(trip, [flight])
  assert.equal(report.nights.find((n) => n.date === '2026-01-14')?.covered, false)
  assert.equal(report.uncovered.includes('2026-01-14'), true)
})

test('night with no lodging raises an alert', () => {
  const report = nightCoverage(trip, [hotel])
  assert.equal(report.nights.length, 11)
  assert.equal(report.nights[0]?.covered, true)
  assert.equal(report.nights[1]?.covered, true)
  assert.equal(report.nights[2]?.date, '2026-01-12')
  assert.equal(report.nights[2]?.covered, false)
  assert.equal(report.coveredCount, 2)
  assert.equal(report.uncovered.length, 9)
  assert.equal(report.uncovered[0], '2026-01-12')
})

test('a night covered by a hotel and a train at once counts once', () => {
  const train = event({
    id: 'night-train',
    kind: 'train',
    starts: zonedFromLocal('2026-01-10T23:00', 60),
    ends: zonedFromLocal('2026-01-11T06:00', 60),
  })
  const report = nightCoverage(trip, [hotel, train])
  const night = report.nights.find((n) => n.date === '2026-01-10')
  assert.equal(night?.coveredBy.length, 2)
  assert.equal(report.coveredCount, 2)
})

test('a one-day trip has zero nights', () => {
  const report = nightCoverage({ startsOn: '2026-01-10', endsOn: '2026-01-10' }, [hotel])
  assert.deepEqual(report, { nights: [], coveredCount: 0, uncovered: [] })
})

test('cancelled events and ideas never cover, even when forced', () => {
  const cancelled = event({
    ...hotel,
    id: 'cancelled-hotel',
    status: 'cancelled',
    coversNight: true,
  })
  const idea = event({ ...hotel, id: 'maybe-hotel', status: 'idea' })
  const report = nightCoverage(trip, [cancelled, idea])
  assert.equal(report.coveredCount, 0)
})

test('covers_night overrides the rule in both directions', () => {
  const forbidden = event({ ...hotel, id: 'day-use', coversNight: false })
  const carNight = event({
    id: 'sleep-in-the-car',
    kind: 'car',
    starts: zonedFromLocal('2026-01-15T20:00', 60),
    coversNight: true,
  })
  const report = nightCoverage(trip, [forbidden, carNight])
  assert.equal(report.nights.find((n) => n.date === '2026-01-10')?.covered, false)
  const night = report.nights.find((n) => n.date === '2026-01-15')
  assert.deepEqual(night?.coveredBy, [
    { eventId: 'sleep-in-the-car', kind: 'car', how: 'override' },
  ])
})

test('a forced multi-night ferry covers every night it spans', () => {
  const ferry = event({
    id: 'long-ferry',
    kind: 'ferry',
    starts: zonedFromLocal('2026-01-16T18:00', 120),
    ends: zonedFromLocal('2026-01-18T08:00', 120),
    coversNight: true,
  })
  const report = nightCoverage(trip, [ferry])
  assert.equal(report.nights.find((n) => n.date === '2026-01-16')?.covered, true)
  assert.equal(report.nights.find((n) => n.date === '2026-01-17')?.covered, true)
  assert.equal(report.nights.find((n) => n.date === '2026-01-18')?.covered, false)
})

test('event without end: a lodging covers its check-in night, a transport covers nothing', () => {
  const openHotel = event({
    id: 'open-hotel',
    kind: 'lodging',
    starts: zonedFromLocal('2026-01-13T14:00', 60),
  })
  const openTrain = event({
    id: 'open-train',
    kind: 'train',
    starts: zonedFromLocal('2026-01-14T23:00', 60),
  })
  const report = nightCoverage(trip, [openHotel, openTrain])
  assert.equal(report.nights.find((n) => n.date === '2026-01-13')?.covered, true)
  assert.equal(report.nights.find((n) => n.date === '2026-01-14')?.covered, false)
})

test('crossing the date line, the night is judged in the departure zone', () => {
  // Departs at 22:00 far east (+600), lands at 10:00 the same calendar day far west (−600):
  // locally it "lands before it departs", but twelve hours pass and the night is on board.
  const flight = event({
    id: 'date-line',
    kind: 'flight',
    starts: zonedFromLocal('2026-01-18T22:00', 600),
    ends: zonedFromLocal('2026-01-18T10:00', -600),
  })
  assert.equal(flight.starts.at, '2026-01-18T12:00:00.000Z')
  assert.equal(flight.ends?.at, '2026-01-18T20:00:00.000Z')
  const report = nightCoverage(trip, [flight])
  assert.equal(report.nights.find((n) => n.date === '2026-01-18')?.covered, true)
  assert.equal(report.nights.find((n) => n.date === '2026-01-17')?.covered, false)
})

test('segments in different zones: an overnight segment covers, a layover does not', () => {
  const overnight = event({
    id: 'red-eye',
    kind: 'flight',
    starts: zonedFromLocal('2026-01-16T22:00', 120),
    ends: zonedFromLocal('2026-01-17T14:00', 540),
    segments: [
      {
        id: 'red-eye-1',
        position: 1,
        departs: zonedFromLocal('2026-01-16T22:00', 120),
        arrives: zonedFromLocal('2026-01-17T14:00', 540),
      },
    ],
  })
  const layover = event({
    id: 'two-legs',
    kind: 'flight',
    starts: zonedFromLocal('2026-01-18T20:00', 120),
    ends: zonedFromLocal('2026-01-19T12:00', 540),
    segments: [
      {
        id: 'leg-1',
        position: 1,
        departs: zonedFromLocal('2026-01-18T20:00', 120),
        arrives: zonedFromLocal('2026-01-18T23:00', 120),
      },
      {
        id: 'leg-2',
        position: 2,
        departs: zonedFromLocal('2026-01-19T06:30', 120),
        arrives: zonedFromLocal('2026-01-19T12:00', 540),
      },
    ],
  })
  const report = nightCoverage(trip, [overnight, layover])
  const covered = report.nights.find((n) => n.date === '2026-01-16')
  assert.deepEqual(covered?.coveredBy, [
    { eventId: 'red-eye', kind: 'flight', how: 'transport', segmentId: 'red-eye-1' },
  ])
  // The whole event spans the window, but nobody sleeps on a plane in a terminal.
  assert.equal(
    windowCoversNight({ departs: layover.starts, arrives: layover.ends! }, '2026-01-18'),
    true
  )
  assert.equal(report.nights.find((n) => n.date === '2026-01-18')?.covered, false)
})

test('DST gap: an overnight train across spring forward still covers the night', () => {
  // Departs with +60 before the clocks jump at 02:00, arrives with +120 after.
  const springTrip = { startsOn: '2026-03-28', endsOn: '2026-03-30' }
  const train = event({
    id: 'dst-train',
    kind: 'train',
    starts: zonedFromLocal('2026-03-28T23:30', 60),
    ends: zonedFromLocal('2026-03-29T07:00', 120),
  })
  const report = nightCoverage(springTrip, [train])
  assert.equal(report.nights.find((n) => n.date === '2026-03-28')?.covered, true)
})

test('DST overlap: a check-out read with the later offset is still the same local date', () => {
  const autumnTrip = { startsOn: '2026-10-24', endsOn: '2026-10-26' }
  const inn = event({
    id: 'autumn-inn',
    kind: 'lodging',
    starts: zonedFromLocal('2026-10-24T16:00', 120),
    // 02:30 happens twice on the 25th; the caller resolved the second reading.
    ends: zonedFromLocal('2026-10-25T02:30', 60),
  })
  const report = nightCoverage(autumnTrip, [inn])
  assert.equal(report.nights.find((n) => n.date === '2026-10-24')?.covered, true)
  assert.equal(report.nights.find((n) => n.date === '2026-10-25')?.covered, false)
})

test('a night transport is recognised for the mascot, a day train or a hotel is not', () => {
  const nights = ['2026-01-12']
  const nightTrain = event({
    id: 'night-train',
    kind: 'train',
    starts: zonedFromLocal('2026-01-12T22:00', 60),
    ends: zonedFromLocal('2026-01-13T07:30', 60),
  })
  const dayTrain = event({
    id: 'day-train',
    kind: 'train',
    starts: zonedFromLocal('2026-01-12T09:00', 60),
    ends: zonedFromLocal('2026-01-12T12:30', 60),
  })
  assert.equal(isNightTransport(nightTrain, nights), true)
  assert.equal(isNightTransport(dayTrain, nights), false)
  assert.equal(isNightTransport(hotel, ['2026-01-10']), false)
})
