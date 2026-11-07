import { test } from '@japa/runner'
import { leaveAt, todayView, type TodayEvent, type TodayViewInput } from '#domain/today_view'

function event(overrides: Partial<TodayEvent> & Pick<TodayEvent, 'id' | 'kind'>): TodayEvent {
  return {
    status: 'booked',
    title: overrides.id,
    startsOn: null,
    endsOn: null,
    startsAt: null,
    endsAt: null,
    startTz: null,
    coversNight: null,
    leaveBufferMin: null,
    travelMin: null,
    ...overrides,
  }
}

const BASE: TodayViewInput = {
  at: '2027-01-22T01:00:00.000Z', // 08:00 in Bangkok, 12:00 in Sydney
  homeTz: 'Australia/Sydney',
  stops: [{ id: 'bkk', tz: 'Asia/Bangkok', arriveOn: '2027-01-21', departOn: '2027-01-24' }],
  events: [],
  segments: [],
  documents: [],
  tasks: [],
  leftTodayMinor: 12_000,
}

test.group('Today view', () => {
  test('today follows the stop time zone', ({ assert }) => {
    const view = todayView(BASE)

    assert.equal(view.tz, 'Asia/Bangkok')
    assert.equal(view.date, '2027-01-22')
  })

  test('without a covering stop today falls back to the last started event, then home', ({
    assert,
  }) => {
    const noStops = todayView({ ...BASE, stops: [] })
    assert.equal(noStops.tz, 'Australia/Sydney')

    const landed = todayView({
      ...BASE,
      stops: [],
      events: [
        event({
          id: 'flight',
          kind: 'flight',
          startsAt: '2027-01-21T20:00:00.000Z',
          startTz: 'Asia/Tokyo',
        }),
      ],
    })
    assert.equal(landed.tz, 'Asia/Tokyo')
  })

  test('next event skips cancelled', ({ assert }) => {
    const view = todayView({
      ...BASE,
      events: [
        event({
          id: 'cancelled',
          kind: 'tour',
          status: 'cancelled',
          startsAt: '2027-01-22T02:00:00.000Z',
          startsOn: '2027-01-22',
        }),
        event({
          id: 'temple',
          kind: 'activity',
          startsAt: '2027-01-22T03:00:00.000Z',
          startsOn: '2027-01-22',
        }),
        event({
          id: 'past',
          kind: 'meal',
          startsAt: '2027-01-21T12:00:00.000Z',
          startsOn: '2027-01-21',
        }),
      ],
    })

    assert.equal(view.nextEvent?.eventId, 'temple')
    assert.equal(view.nextEvent?.countdownMs, 2 * 60 * 60 * 1000)
    assert.deepEqual(view.todayEventIds, ['temple'])
  })

  test('leave at subtracts kind buffer and travel time', ({ assert }) => {
    const flight = event({ id: 'flight', kind: 'flight', travelMin: 40 })
    const train = event({ id: 'train', kind: 'train', leaveBufferMin: 10 })

    // 150 min flight buffer + 40 min travel
    assert.equal(leaveAt(flight, '2027-01-22T10:00:00.000Z'), '2027-01-22T06:50:00.000Z')
    // explicit 10 min buffer, no travel
    assert.equal(leaveAt(train, '2027-01-22T10:00:00.000Z'), '2027-01-22T09:50:00.000Z')
  })

  test('a multi-leg flight surfaces its next segment', ({ assert }) => {
    const view = todayView({
      ...BASE,
      events: [
        event({
          id: 'flight',
          kind: 'flight',
          startsAt: '2027-01-21T20:00:00.000Z',
          startsOn: '2027-01-22',
        }),
      ],
      segments: [
        { id: 'leg-1', eventId: 'flight', departsAt: '2027-01-21T20:00:00.000Z' },
        { id: 'leg-2', eventId: 'flight', departsAt: '2027-01-22T04:00:00.000Z' },
      ],
    })

    assert.equal(view.nextEvent?.segmentId, 'leg-2')
    assert.equal(view.nextEvent?.startsAt, '2027-01-22T04:00:00.000Z')
  })

  test('print document resurfaces on the event day', ({ assert }) => {
    const view = todayView({
      ...BASE,
      events: [
        event({
          id: 'train',
          kind: 'train',
          startsOn: '2027-01-22',
          startsAt: '2027-01-22T05:00:00.000Z',
        }),
        event({
          id: 'tomorrow',
          kind: 'tour',
          startsOn: '2027-01-23',
          startsAt: '2027-01-23T05:00:00.000Z',
        }),
      ],
      documents: [
        { id: 'voucher', eventId: 'train', tags: ['print'] },
        { id: 'later', eventId: 'tomorrow', tags: ['print'] },
        { id: 'passport', eventId: null, tags: ['requires_passport'] },
        { id: 'map', eventId: 'train', tags: [] },
      ],
    })

    assert.deepEqual(view.todayDocumentIds, ['voucher'])
  })

  test('the passport reminder shows on flight days', ({ assert }) => {
    const view = todayView({
      ...BASE,
      events: [
        event({
          id: 'flight',
          kind: 'flight',
          startsOn: '2027-01-22',
          startsAt: '2027-01-22T05:00:00.000Z',
        }),
      ],
      documents: [{ id: 'passport', eventId: null, tags: ['requires_passport'] }],
    })

    assert.deepEqual(view.todayDocumentIds, ['passport'])
  })

  test('where we sleep and open tasks with their urgency come along', ({ assert }) => {
    const view = todayView({
      ...BASE,
      events: [
        event({ id: 'hotel', kind: 'lodging', startsOn: '2027-01-21', endsOn: '2027-01-24' }),
      ],
      tasks: [
        { id: 'late', dueOn: '2027-01-20', done: false },
        { id: 'done', dueOn: '2027-01-20', done: true },
        { id: 'open', dueOn: null, done: false },
      ],
    })

    assert.deepEqual(view.sleepingAt, { eventId: 'hotel', kind: 'lodging', title: 'hotel' })
    assert.deepEqual(view.tasks, [
      { taskId: 'late', urgency: 'overdue' },
      { taskId: 'open', urgency: 'no_date' },
    ])
    assert.equal(view.leftTodayMinor, 12_000)
  })
})
