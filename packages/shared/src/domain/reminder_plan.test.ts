import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_REMINDER_SETTINGS,
  planReminders,
  type PlannedReminder,
  type ReminderPlanInput,
  type ReminderSettings,
  type ReminderTrip,
} from './reminder_plan.ts'
import type { TripEvent } from './trip_event.ts'
import type { TripTask } from './trip_task.ts'
import { epochMs, zonedFromLocal } from './zoned_instant.ts'

// Synthetic zones: invented names with fixed offsets, plus one with a DST switch.
const FIXED_OFFSETS: Record<string, number> = {
  'Home/Zone': -300,
  'Harbour/Zone': 540,
  'Dateline/East': 720,
  'Dateline/West': -600,
}

// "Spring/Zone" moves from +60 to +120 at 2027-03-28T01:00Z (as a European zone does).
const SPRING_SWITCH_MS = Date.parse('2027-03-28T01:00:00Z')

function offsetAt(tz: string, at: string): number {
  if (tz === 'Spring/Zone') return epochMs(at) >= SPRING_SWITCH_MS ? 120 : 60
  const offset = FIXED_OFFSETS[tz]
  if (offset === undefined) throw new Error(`unknown zone ${tz}`)
  return offset
}

function event(
  overrides: Partial<TripEvent> & Pick<TripEvent, 'id' | 'kind' | 'starts'>
): TripEvent {
  return { status: 'booked', title: 'Synthetic event', ends: null, ...overrides }
}

function task(overrides: Partial<TripTask> & Pick<TripTask, 'id'>): TripTask {
  return {
    title: `Task ${overrides.id}`,
    dueOn: null,
    priority: 'normal',
    doneAt: null,
    origin: 'manual',
    ...overrides,
  }
}

function harbourTrip(overrides: Partial<ReminderTrip> = {}): ReminderTrip {
  return {
    id: 'trip-1',
    name: 'Demo Loop',
    startsOn: '2027-03-08',
    endsOn: '2027-03-20',
    homeTz: 'Home/Zone',
    stops: [
      {
        id: 'stop-harbour',
        position: 1,
        name: 'Harbour City',
        countryCode: 'XA',
        tz: 'Harbour/Zone',
        arriveOn: '2027-03-08',
        departOn: '2027-03-20',
      },
    ],
    events: [],
    tasks: [],
    ...overrides,
  }
}

function plan(
  now: string,
  trips: ReminderTrip[],
  settings: Partial<ReminderSettings> = {},
  extra: Partial<ReminderPlanInput> = {}
): PlannedReminder[] {
  return planReminders({
    now,
    settings: { ...DEFAULT_REMINDER_SETTINGS, ...settings },
    trips,
    offsetAt,
    ...extra,
  })
}

test('leave at reminder fires at the leave time in the event zone', () => {
  const flight = event({
    id: 'ev-flight',
    kind: 'flight',
    title: 'Flight to Old Town',
    // 14:00 at +540 is 05:00Z; 150 min buffer + 30 min travel → leave at 11:00 local.
    starts: zonedFromLocal('2027-03-10T14:00', 540, 'Harbour/Zone'),
    travelMin: 30,
  })
  const dinner = event({
    id: 'ev-dinner',
    kind: 'meal',
    starts: zonedFromLocal('2027-03-10T19:00', 540, 'Harbour/Zone'),
  })

  const reminders = plan('2027-03-09T12:00:00.000Z', [harbourTrip({ events: [flight, dinner] })], {
    tasksDue: false,
  })

  assert.deepEqual(reminders, [
    {
      kind: 'leave_at',
      tripId: 'trip-1',
      refId: 'ev-flight',
      fireAt: '2027-03-10T02:00:00.000Z',
      nominalFireAt: '2027-03-10T02:00:00.000Z',
      titleKey: 'reminders.leave_at.title',
      bodyKey: 'reminders.leave_at.body',
      params: {
        tripName: 'Demo Loop',
        title: 'Flight to Old Town',
        leaveTime: '11:00',
        startTime: '14:00',
      },
      url: '/t/trip-1/plan/e/ev-flight',
    },
  ])
})

test('leave at covers trains, ferries and buses and skips cancelled events and ideas', () => {
  const starts = zonedFromLocal('2027-03-10T12:00', 540, 'Harbour/Zone')
  const events = [
    event({ id: 'ev-train', kind: 'train', starts }),
    event({ id: 'ev-ferry', kind: 'ferry', starts }),
    event({ id: 'ev-bus', kind: 'bus', starts, leaveBufferMin: 5 }),
    event({ id: 'ev-car', kind: 'car', starts }),
    event({ id: 'ev-cancelled', kind: 'train', starts, status: 'cancelled' }),
    event({ id: 'ev-idea', kind: 'train', starts, status: 'idea' }),
  ]

  const reminders = plan('2027-03-09T12:00:00.000Z', [harbourTrip({ events })], { tasksDue: false })

  assert.deepEqual(
    reminders.map((r) => [r.refId, r.fireAt]),
    [
      ['ev-ferry', '2027-03-10T02:15:00.000Z'],
      ['ev-train', '2027-03-10T02:30:00.000Z'],
      ['ev-bus', '2027-03-10T02:55:00.000Z'],
    ]
  )
})

test('check out reminder fires an hour before', () => {
  const hotel = event({
    id: 'ev-hotel',
    kind: 'lodging',
    title: 'Quay Lodge',
    starts: zonedFromLocal('2027-03-08T15:00', 540, 'Harbour/Zone'),
    ends: zonedFromLocal('2027-03-10T11:00', 540, 'Harbour/Zone'),
  })

  const reminders = plan('2027-03-09T12:00:00.000Z', [harbourTrip({ events: [hotel] })], {
    tasksDue: false,
  })

  assert.deepEqual(reminders, [
    {
      kind: 'check_out',
      tripId: 'trip-1',
      refId: 'ev-hotel',
      // 10:00 at +540.
      fireAt: '2027-03-10T01:00:00.000Z',
      nominalFireAt: '2027-03-10T01:00:00.000Z',
      titleKey: 'reminders.check_out.title',
      bodyKey: 'reminders.check_out.body',
      params: { tripName: 'Demo Loop', title: 'Quay Lodge', checkOutTime: '11:00' },
      url: '/t/trip-1/today',
    },
  ])
})

test('an early check out fires at eight local, never at or after the check out', () => {
  const lodging = (id: string, endsLocal: string) =>
    event({
      id,
      kind: 'lodging',
      starts: zonedFromLocal('2027-03-08T15:00', 540, 'Harbour/Zone'),
      ends: zonedFromLocal(endsLocal, 540, 'Harbour/Zone'),
    })
  const events = [
    lodging('ev-half-nine', '2027-03-10T09:30'),
    lodging('ev-seven', '2027-03-11T07:00'),
    lodging('ev-ten', '2027-03-10T10:00'),
  ]

  const reminders = plan('2027-03-09T12:00:00.000Z', [harbourTrip({ events })], {
    tasksDue: false,
  })

  assert.deepEqual(
    reminders.map((r) => [r.refId, r.fireAt]),
    [
      // 09:30 is before ten: eight o'clock local.
      ['ev-half-nine', '2027-03-09T23:00:00.000Z'],
      // 10:00 is not before ten: an hour before, 09:00 local.
      ['ev-ten', '2027-03-10T00:00:00.000Z'],
      // 07:00: eight would be after the check out, so an hour before, 06:00 local.
      ['ev-seven', '2027-03-10T21:00:00.000Z'],
    ]
  )
})

test('daily task digest at nine local', () => {
  const tasks = [
    task({ id: 'due-today', title: 'Buy ferry tickets', dueOn: '2027-03-10' }),
    task({ id: 'late-high', title: 'Renew insurance', dueOn: '2027-03-05', priority: 'high' }),
    task({ id: 'late-normal', title: 'Postcards', dueOn: '2027-03-05' }),
    task({ id: 'done', dueOn: '2027-03-10', doneAt: '2027-03-09T01:00:00.000Z' }),
    task({ id: 'due-tomorrow', title: 'Pack', dueOn: '2027-03-11' }),
    task({ id: 'undated', dueOn: null, priority: 'high' }),
  ]

  // Midnight of 2027-03-10 at +540; the horizon reaches 12:00 local of the 11th.
  const reminders = plan('2027-03-09T15:00:00.000Z', [harbourTrip({ tasks })])

  assert.deepEqual(reminders, [
    {
      kind: 'tasks_due',
      tripId: 'trip-1',
      refId: 'trip-1:2027-03-10',
      fireAt: '2027-03-10T00:00:00.000Z',
      nominalFireAt: '2027-03-10T00:00:00.000Z',
      titleKey: 'reminders.tasks_due.title',
      bodyKey: 'reminders.tasks_due.body',
      params: {
        tripName: 'Demo Loop',
        count: 2,
        titles: 'Renew insurance, Buy ferry tickets',
        more: 0,
      },
      url: '/t/trip-1/more/tasks',
    },
    {
      kind: 'tasks_due',
      tripId: 'trip-1',
      refId: 'trip-1:2027-03-11',
      fireAt: '2027-03-11T00:00:00.000Z',
      nominalFireAt: '2027-03-11T00:00:00.000Z',
      titleKey: 'reminders.tasks_due.title',
      bodyKey: 'reminders.tasks_due.body',
      params: { tripName: 'Demo Loop', count: 2, titles: 'Renew insurance, Pack', more: 0 },
      url: '/t/trip-1/more/tasks',
    },
  ])
})

test('the digest lists at most three titles and counts the rest', () => {
  const tasks = ['a', 'b', 'c', 'd', 'e'].map((id) =>
    task({ id, title: `Task ${id}`, dueOn: '2027-03-10' })
  )

  const [digest] = plan(
    '2027-03-09T15:00:00.000Z',
    [harbourTrip({ tasks })],
    {},
    { horizonHours: 12 }
  )

  assert.deepEqual(digest?.params, {
    tripName: 'Demo Loop',
    count: 5,
    titles: 'Task a, Task b, Task c',
    more: 2,
  })
})

test('no digest is planned for a day with nothing due, nor after the trip', () => {
  const tasks = [task({ id: 'late-high', dueOn: '2027-03-01', priority: 'high' })]

  const quiet = plan('2027-03-09T15:00:00.000Z', [harbourTrip()])
  // The trip ends on the 10th: only that day gets a digest.
  const ending = plan('2027-03-09T15:00:00.000Z', [harbourTrip({ endsOn: '2027-03-10', tasks })])

  assert.deepEqual(quiet, [])
  assert.deepEqual(
    ending.map((r) => r.refId),
    ['trip-1:2027-03-10']
  )
})

test('quiet hours move a reminder to their end', () => {
  const flight = event({
    id: 'ev-early',
    kind: 'flight',
    // Leave at 05:30 local, inside 22:00–07:00: moved to 07:00, still before the 08:00 departure.
    starts: zonedFromLocal('2027-03-10T08:00', 540, 'Harbour/Zone'),
  })
  const tasks = [task({ id: 'due', dueOn: '2027-03-10' })]

  const overnight = plan('2027-03-09T12:00:00.000Z', [harbourTrip({ events: [flight] })], {
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  })
  const morning = plan(
    '2027-03-09T15:00:00.000Z',
    [harbourTrip({ tasks })],
    {
      quietHoursStart: '08:00',
      quietHoursEnd: '10:30',
    },
    { horizonHours: 24 }
  )

  assert.deepEqual(
    overnight.map((r) => [r.kind, r.fireAt]),
    [['leave_at', '2027-03-09T22:00:00.000Z']]
  )
  // Nine o'clock falls inside 08:00–10:30: the digest moves to 10:30 local.
  assert.deepEqual(
    morning.map((r) => [r.kind, r.fireAt]),
    [['tasks_due', '2027-03-10T01:30:00.000Z']]
  )
})

test('quiet hours that start before midnight move a late reminder to the next morning', () => {
  const hotel = event({
    id: 'ev-hotel',
    kind: 'lodging',
    starts: zonedFromLocal('2027-03-08T15:00', 540, 'Harbour/Zone'),
    // Check out 23:59: an hour before is 22:59, inside 22:00–07:00 and the move
    // to 07:00 the next day would be after the check out, so it stays.
    ends: zonedFromLocal('2027-03-10T23:59', 540, 'Harbour/Zone'),
  })
  const night = event({
    id: 'ev-night-train',
    kind: 'train',
    // Leave at 23:30 local for a 00:00 departure: the move to 07:00 would miss it.
    starts: zonedFromLocal('2027-03-11T00:00', 540, 'Harbour/Zone'),
  })
  const late = event({
    id: 'ev-late-ferry',
    kind: 'ferry',
    // A 23:00 ferry with its 45 min buffer: leave at 22:15 local; the move would miss it too.
    starts: zonedFromLocal('2027-03-10T23:00', 540, 'Harbour/Zone'),
  })
  const bus = event({
    id: 'ev-morning-bus',
    kind: 'bus',
    leaveBufferMin: 600,
    // Leave at 22:30 local for a 08:30 bus: moved to 07:00 the next morning.
    starts: zonedFromLocal('2027-03-11T08:30', 540, 'Harbour/Zone'),
  })

  const reminders = plan(
    '2027-03-09T12:00:00.000Z',
    [harbourTrip({ events: [hotel, night, late, bus] })],
    { tasksDue: false, quietHoursStart: '22:00', quietHoursEnd: '07:00' }
  )

  assert.deepEqual(
    reminders.map((r) => [r.refId, r.fireAt]),
    [
      ['ev-late-ferry', '2027-03-10T13:15:00.000Z'],
      ['ev-hotel', '2027-03-10T13:59:00.000Z'],
      ['ev-night-train', '2027-03-10T14:30:00.000Z'],
      ['ev-morning-bus', '2027-03-10T22:00:00.000Z'],
    ]
  )
})

test('a disabled kind is never planned', () => {
  const trip = harbourTrip({
    events: [
      event({
        id: 'ev-flight',
        kind: 'flight',
        starts: zonedFromLocal('2027-03-10T14:00', 540, 'Harbour/Zone'),
      }),
      event({
        id: 'ev-hotel',
        kind: 'lodging',
        starts: zonedFromLocal('2027-03-08T15:00', 540, 'Harbour/Zone'),
        ends: zonedFromLocal('2027-03-10T11:00', 540, 'Harbour/Zone'),
      }),
    ],
    tasks: [task({ id: 'due', dueOn: '2027-03-10' })],
  })
  const now = '2027-03-09T12:00:00.000Z'

  const all = plan(now, [trip])
  const noLeave = plan(now, [trip], { leaveAt: false })
  const noCheckOut = plan(now, [trip], { checkOut: false })
  const noTasks = plan(now, [trip], { tasksDue: false })
  const none = plan(now, [trip], { leaveAt: false, checkOut: false, tasksDue: false })

  const kinds = (list: PlannedReminder[]) => list.map((r) => r.kind).sort()
  assert.deepEqual(kinds(all), ['check_out', 'leave_at', 'tasks_due'])
  assert.deepEqual(kinds(noLeave), ['check_out', 'tasks_due'])
  assert.deepEqual(kinds(noCheckOut), ['leave_at', 'tasks_due'])
  assert.deepEqual(kinds(noTasks), ['check_out', 'leave_at'])
  assert.deepEqual(none, [])
})

test('an event across the date line is read in its departure zone', () => {
  const flight = event({
    id: 'ev-dateline',
    kind: 'flight',
    // 23:30 at +720 (11:30Z) lands on the "same" day at −600; leave at 21:00 local.
    starts: zonedFromLocal('2027-03-10T23:30', 720, 'Dateline/East'),
    ends: zonedFromLocal('2027-03-10T03:30', -600, 'Dateline/West'),
  })
  const trip = harbourTrip({ stops: [], homeTz: 'Dateline/East', events: [flight] })

  // 22:00–07:00 quiet hours: 21:00 in the departure zone is outside them (in the
  // arrival zone the same instant is 23:00 of the 9th, which would be inside).
  const reminders = plan('2027-03-10T00:00:00.000Z', [trip], {
    tasksDue: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  })

  assert.deepEqual(
    reminders.map((r) => [r.refId, r.fireAt, r.params['leaveTime']]),
    [['ev-dateline', '2027-03-10T09:00:00.000Z', '21:00']]
  )
})

test('the digest follows the stop offset of that day even when an event was stored with another', () => {
  const trip: ReminderTrip = {
    id: 'trip-spring',
    name: 'Spring Loop',
    startsOn: '2027-03-25',
    endsOn: '2027-04-02',
    homeTz: 'Home/Zone',
    stops: [
      {
        id: 'stop-spring',
        position: 1,
        name: 'Canal Town',
        countryCode: 'XC',
        tz: 'Spring/Zone',
        arriveOn: '2027-03-25',
        departOn: '2027-04-02',
      },
    ],
    events: [
      // Started before the switch, so it carries the old +60 offset.
      event({
        id: 'ev-walk',
        kind: 'tour',
        starts: zonedFromLocal('2027-03-27T10:00', 60, 'Spring/Zone'),
      }),
    ],
    tasks: [task({ id: 'due', dueOn: '2027-03-28' })],
  }

  // 21:00 local on the 27th (+60); the clocks move to +120 overnight.
  const reminders = plan('2027-03-27T20:00:00.000Z', [trip], {}, { horizonHours: 24 })

  assert.deepEqual(
    reminders.map((r) => [r.refId, r.fireAt]),
    // 09:00 at +120, not at the +60 the event and the evening before had.
    [['trip-spring:2027-03-28', '2027-03-28T07:00:00.000Z']]
  )
})

test('only reminders inside [now, now + horizon) are planned', () => {
  const at = (id: string, local: string) =>
    event({ id, kind: 'bus', leaveBufferMin: 0, starts: zonedFromLocal(local, 0, 'Harbour/Zone') })
  const trip = harbourTrip({
    events: [
      at('ev-past', '2027-03-09T11:59'),
      at('ev-now', '2027-03-09T12:00'),
      at('ev-last', '2027-03-11T00:00'),
      at('ev-beyond', '2027-03-11T00:01'),
    ],
  })

  const reminders = plan('2027-03-09T12:00:00.000Z', [trip], { tasksDue: false })
  const shorter = plan('2027-03-09T12:00:00.000Z', [trip], { tasksDue: false }, { horizonHours: 1 })

  assert.deepEqual(
    reminders.map((r) => r.refId),
    ['ev-now']
  )
  assert.deepEqual(
    shorter.map((r) => r.refId),
    ['ev-now']
  )
  const longer = plan('2027-03-09T12:00:00.000Z', [trip], { tasksDue: false }, { horizonHours: 37 })
  assert.deepEqual(
    longer.map((r) => r.refId),
    ['ev-now', 'ev-last', 'ev-beyond']
  )
})

test('the same reminder keeps its kind, ref and fire time from one run to the next', () => {
  const trips = [
    harbourTrip({
      events: [
        event({
          id: 'ev-flight',
          kind: 'flight',
          starts: zonedFromLocal('2027-03-10T14:00', 540, 'Harbour/Zone'),
        }),
        event({
          id: 'ev-hotel',
          kind: 'lodging',
          starts: zonedFromLocal('2027-03-08T15:00', 540, 'Harbour/Zone'),
          ends: zonedFromLocal('2027-03-10T11:00', 540, 'Harbour/Zone'),
        }),
      ],
      tasks: [task({ id: 'due', dueOn: '2027-03-10' })],
    }),
    harbourTrip({
      id: 'trip-2',
      name: 'Second Loop',
      tasks: [task({ id: 'x', dueOn: '2027-03-10' })],
    }),
  ]
  const key = (r: PlannedReminder) => `${r.kind}|${r.refId}|${r.fireAt}`

  const first = plan('2027-03-09T15:00:00.000Z', trips)
  const again = plan('2027-03-09T15:00:00.000Z', trips)
  const later = plan('2027-03-09T23:59:00.000Z', trips)

  assert.deepEqual(again, first)
  assert.deepEqual(later.map(key), first.map(key))
  // Sorted by fire time, ties by trip then kind then ref.
  assert.deepEqual(
    first.map((r) => [r.tripId, r.kind]),
    [
      ['trip-1', 'tasks_due'],
      ['trip-2', 'tasks_due'],
      ['trip-1', 'check_out'],
      ['trip-1', 'leave_at'],
    ]
  )
})

test('half-set or malformed quiet hours are ignored', () => {
  const trip = harbourTrip({
    events: [
      event({
        id: 'ev-early',
        kind: 'flight',
        starts: zonedFromLocal('2027-03-10T08:00', 540, 'Harbour/Zone'),
      }),
    ],
  })
  const now = '2027-03-09T12:00:00.000Z'

  const half = plan(now, [trip], { tasksDue: false, quietHoursStart: '22:00', quietHoursEnd: null })
  const bad = plan(now, [trip], {
    tasksDue: false,
    quietHoursStart: '25:00',
    quietHoursEnd: '07:00',
  })

  assert.deepEqual(
    half.map((r) => r.fireAt),
    ['2027-03-09T20:30:00.000Z']
  )
  assert.deepEqual(
    bad.map((r) => r.fireAt),
    ['2027-03-09T20:30:00.000Z']
  )
})

test('a reminder moved by quiet hours keeps its nominal fire time', () => {
  const flight = event({
    id: 'ev-early',
    kind: 'flight',
    // Leave at 05:30 local (20:30Z the day before); 22:00–07:00 moves it to 07:00 local.
    starts: zonedFromLocal('2027-03-10T08:00', 540, 'Harbour/Zone'),
  })
  const trip = harbourTrip({ events: [flight] })
  const now = '2027-03-09T12:00:00.000Z'

  const [quiet] = plan(now, [trip], {
    tasksDue: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  })
  const [loud] = plan(now, [trip], { tasksDue: false })

  assert.equal(quiet?.fireAt, '2027-03-09T22:00:00.000Z')
  assert.equal(quiet?.nominalFireAt, '2027-03-09T20:30:00.000Z')
  assert.equal(loud?.fireAt, '2027-03-09T20:30:00.000Z')
  assert.equal(loud?.nominalFireAt, '2027-03-09T20:30:00.000Z')
})

test('toggling quiet hours keeps every reminder under the same dedupe key', () => {
  const trip = harbourTrip({
    events: [
      event({
        id: 'ev-early',
        kind: 'flight',
        starts: zonedFromLocal('2027-03-10T08:00', 540, 'Harbour/Zone'),
      }),
      event({
        id: 'ev-hotel',
        kind: 'lodging',
        starts: zonedFromLocal('2027-03-08T15:00', 540, 'Harbour/Zone'),
        ends: zonedFromLocal('2027-03-10T11:00', 540, 'Harbour/Zone'),
      }),
    ],
    tasks: [task({ id: 'due', dueOn: '2027-03-10' })],
  })
  const key = (r: PlannedReminder) => `${r.kind}|${r.refId}|${r.nominalFireAt}`
  const now = '2027-03-09T12:00:00.000Z'

  const loud = plan(now, [trip])
  // The digest moves from 09:00 to 09:30 local; the flight and the check-out stay.
  const quiet = plan(now, [trip], { quietHoursStart: '05:00', quietHoursEnd: '09:30' })

  assert.notDeepEqual(
    quiet.map((r) => r.fireAt),
    loud.map((r) => r.fireAt)
  )
  assert.deepEqual(quiet.map(key).sort(), loud.map(key).sort())
})
