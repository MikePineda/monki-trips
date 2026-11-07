import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOverSpendThreshold, mascotState, type MascotInput } from './mascot_state.ts'
import type { TripEvent } from './trip_event.ts'
import type { TripTask } from './trip_task.ts'
import { zonedFromLocal } from './zoned_instant.ts'

const trip = { startsOn: '2026-01-10', endsOn: '2026-01-21' }

function event(partial: Partial<TripEvent> & Pick<TripEvent, 'id' | 'kind' | 'starts'>): TripEvent {
  return { status: 'booked', title: partial.id, ends: null, ...partial }
}

const nightTrain = event({
  id: 'night-train',
  kind: 'train',
  starts: zonedFromLocal('2026-01-12T22:00', 60),
  ends: zonedFromLocal('2026-01-13T07:30', 60),
})

const overdueHigh: TripTask = {
  id: 'task-visa',
  title: 'Visa',
  dueOn: '2026-01-11',
  priority: 'high',
  doneAt: null,
  origin: 'manual',
}

// 12:00 local on day 4, nothing special going on.
const calm: MascotInput = {
  trip,
  now: '2026-01-13T11:00:00Z',
  offsetMin: 60,
  events: [],
  budget: { budgetMinor: 100_000n, spentMinor: 40_000n },
  tasks: [],
  todayDocuments: [],
}

test('a calm day is happy', () => {
  assert.equal(mascotState(calm), 'happy')
})

test('asleep during overnight train beats worried', () => {
  const state = mascotState({
    ...calm,
    now: '2026-01-13T05:00:00Z', // 06:00 local, still on the train
    events: [nightTrain],
    tasks: [overdueHigh],
  })
  assert.equal(state, 'asleep')
})

test('asleep between 22:00 and 06:00 local, awake at 06:00', () => {
  assert.equal(mascotState({ ...calm, now: '2026-01-13T21:30:00Z' }), 'asleep') // 22:30
  assert.equal(mascotState({ ...calm, now: '2026-01-13T04:59:00Z' }), 'asleep') // 05:59
  assert.equal(mascotState({ ...calm, now: '2026-01-13T05:00:00Z' }), 'happy') // 06:00
  assert.equal(mascotState({ ...calm, now: '2026-01-13T20:59:00Z' }), 'happy') // 21:59
})

test('a day train is not a bed: not asleep at noon on board', () => {
  const dayTrain = event({
    id: 'day-train',
    kind: 'train',
    starts: zonedFromLocal('2026-01-13T11:00', 60),
    ends: zonedFromLocal('2026-01-13T14:00', 60),
  })
  assert.equal(mascotState({ ...calm, events: [dayTrain] }), 'excited')
})

test('worried above ninety percent', () => {
  assert.equal(
    mascotState({ ...calm, budget: { budgetMinor: 100_000n, spentMinor: 90_001n } }),
    'worried'
  )
  assert.equal(
    mascotState({ ...calm, budget: { budgetMinor: 100_000n, spentMinor: 90_000n } }),
    'happy'
  )
  assert.equal(isOverSpendThreshold({ budgetMinor: 10n, spentMinor: 10n }), true)
})

test('zero budget never worries', () => {
  assert.equal(mascotState({ ...calm, budget: { budgetMinor: 0n, spentMinor: 5_000n } }), 'happy')
  assert.equal(mascotState({ ...calm, budget: { budgetMinor: null, spentMinor: 5_000n } }), 'happy')
  assert.equal(mascotState({ ...calm, budget: null }), 'happy')
})

test('an overdue high task worries, a done one does not', () => {
  assert.equal(mascotState({ ...calm, tasks: [overdueHigh] }), 'worried')
  assert.equal(
    mascotState({ ...calm, tasks: [{ ...overdueHigh, doneAt: '2026-01-11T09:00:00Z' }] }),
    'happy'
  )
  assert.equal(mascotState({ ...calm, tasks: [{ ...overdueHigh, priority: 'normal' }] }), 'happy')
})

test('missing offline document today worries', () => {
  assert.equal(
    mascotState({
      ...calm,
      todayDocuments: [{ tags: ['show_on_phone'], availableOffline: false }],
    }),
    'worried'
  )
  assert.equal(
    mascotState({ ...calm, todayDocuments: [{ tags: ['print'], availableOffline: false }] }),
    'worried'
  )
  assert.equal(
    mascotState({
      ...calm,
      todayDocuments: [{ tags: ['requires_passport'], availableOffline: false }],
    }),
    'happy'
  )
  assert.equal(
    mascotState({ ...calm, todayDocuments: [{ tags: ['print'], availableOffline: true }] }),
    'happy'
  )
})

test('celebrating after trip end', () => {
  assert.equal(mascotState({ ...calm, now: '2026-01-22T11:00:00Z' }), 'celebrating')
  assert.equal(mascotState({ ...calm, now: '2026-01-28T11:00:00Z' }), 'celebrating')
  assert.equal(mascotState({ ...calm, now: '2026-01-29T11:00:00Z' }), 'happy')
  // The last day is still travelling.
  assert.equal(mascotState({ ...calm, now: '2026-01-21T11:00:00Z' }), 'happy')
  // Celebrating beats everything, even an overdue task at night.
  assert.equal(
    mascotState({ ...calm, now: '2026-01-22T23:00:00Z', tasks: [overdueHigh] }),
    'celebrating'
  )
})

test('excited on a flight day and on departure day, but worry comes first', () => {
  const flight = event({
    id: 'flight',
    kind: 'flight',
    starts: zonedFromLocal('2026-01-13T16:00', 60),
    ends: zonedFromLocal('2026-01-13T19:00', 60),
  })
  assert.equal(mascotState({ ...calm, events: [flight] }), 'excited')
  assert.equal(mascotState({ ...calm, events: [{ ...flight, status: 'cancelled' }] }), 'happy')
  assert.equal(mascotState({ ...calm, now: '2026-01-10T11:00:00Z' }), 'excited')
  assert.equal(mascotState({ ...calm, events: [flight], tasks: [overdueHigh] }), 'worried')
})
