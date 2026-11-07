import { blankDocument, blankSegment, placedEvent } from '../../testing/fake-trip-content'
import {
  todayScreen,
  type TodayExpenseRow,
  type TodayScreenInput,
  type TodayTaskRow,
} from './today-screen'

const TRIP = {
  startDate: '2027-01-20',
  endDate: '2027-01-24',
  baseCurrency: 'AUD',
  budgetTotalMinor: null as number | null,
  homeTz: 'Australia/Sydney',
}

const STOP = {
  id: 'stop-1',
  position: 0,
  name: 'Port Vellmar',
  countryCode: 'XA',
  tz: 'Asia/Bangkok',
  arriveOn: '2027-01-20',
  departOn: '2027-01-24',
}

function input(overrides: Partial<TodayScreenInput> = {}): TodayScreenInput {
  return {
    trip: TRIP,
    stops: [STOP],
    events: [],
    segments: [],
    docs: [],
    blobs: [],
    tasks: [],
    expenses: [],
    weather: null,
    // 12:00 in Port Vellmar (UTC+7), day 2 of 5.
    now: '2027-01-21T05:00:00.000Z',
    deviceZone: 'Australia/Sydney',
    ...overrides,
  }
}

function expense(overrides: Partial<TodayExpenseRow>): TodayExpenseRow {
  return {
    id: 'x',
    eventId: null,
    amountMinor: 1000,
    currency: 'AUD',
    baseAmountMinor: 1000,
    fxRate: '1',
    spentOn: '2027-01-21',
    updatedAt: '2027-01-21T00:00:00.000Z',
    ...overrides,
  }
}

function task(overrides: Partial<TodayTaskRow>): TodayTaskRow {
  return {
    id: 'task',
    title: 'Task',
    titleKey: null,
    dueOn: null,
    priority: 'normal',
    doneAt: null,
    origin: 'manual',
    sourceDocumentId: null,
    eventId: null,
    ...overrides,
  }
}

describe('todayScreen', () => {
  it('today picks the next event across zones', () => {
    const screen = todayScreen(
      input({
        events: [
          // 10:00 in Tokyo is 01:00 UTC on the 22nd.
          placedEvent('2027-01-22T10:00', 'Asia/Tokyo', { id: 'tokyo', title: 'Tokyo tour' }),
          // 02:00 in Athens is 00:00 UTC on the 22nd: earlier, though its clock reads later in the day.
          placedEvent('2027-01-22T02:00', 'Europe/Athens', { id: 'athens', title: 'Athens walk' }),
          placedEvent('2027-01-21T09:00', 'Asia/Bangkok', { id: 'past', title: 'Breakfast' }),
        ],
      })
    )

    expect(screen.view.nextEvent?.eventId).toBe('athens')
    expect(screen.view.nextEvent?.startsLocal).toBe('2027-01-22T02:00')
    expect(screen.view.nextEvent?.tz).toBe('Europe/Athens')
    expect(screen.view.dayNumber).toBe(2)
    expect(screen.view.stop?.name).toBe('Port Vellmar')
  })

  it('leave at uses the kind buffer', () => {
    const flight = todayScreen(
      input({
        events: [
          placedEvent('2027-01-21T18:30', 'Asia/Bangkok', {
            id: 'f',
            kind: 'flight',
            title: 'Flight out',
            travelMin: 30,
          }),
        ],
      })
    )
    // Flights default to 150 minutes, plus 30 to get to the airport.
    expect(flight.view.nextEvent?.leaveAtLocal).toBe('2027-01-21T15:30')

    const train = todayScreen(
      input({
        events: [
          placedEvent('2027-01-21T18:30', 'Asia/Bangkok', { id: 't', kind: 'train', title: 'T' }),
        ],
      })
    )
    expect(train.view.nextEvent?.leaveAtLocal).toBe('2027-01-21T18:00')
  })

  it('a leg of a transport is the next event, with its route', () => {
    const screen = todayScreen(
      input({
        events: [placedEvent('2027-01-21T18:30', 'Asia/Bangkok', { id: 'f1', kind: 'flight' })],
        segments: [
          blankSegment({
            id: 'g1',
            eventId: 'f1',
            departsLocal: '2027-01-21T18:30',
            arrivesLocal: '2027-01-21T20:00',
          }),
        ],
      })
    )

    expect(screen.view.nextEvent?.segmentId).toBe('g1')
    expect(screen.view.nextEvent?.route).toEqual({ from: 'PVM', to: 'ALD' })
  })

  it('left today includes pending expenses', () => {
    const screen = todayScreen(
      input({
        trip: { ...TRIP, budgetTotalMinor: 100_000 },
        expenses: [
          expense({
            id: 'before',
            spentOn: '2027-01-20',
            amountMinor: 10_000,
            baseAmountMinor: 10_000,
          }),
          expense({
            id: 'queued',
            amountMinor: 2_000,
            baseAmountMinor: 2_000,
            syncState: 'pending',
          }),
        ],
      })
    )

    // (100 000 − 10 000) over the four days left, today included, minus today's queued 2 000.
    expect(screen.view.budget.allowanceTodayMinor).toBe(22_500n)
    expect(screen.view.budget.leftTodayMinor).toBe(20_500n)
    expect(screen.view.budget.pendingSyncCount).toBe(1)
  })

  it('mascot is worried when a today document is not offline', () => {
    const events = [placedEvent('2027-01-21T15:00', 'Asia/Bangkok', { id: 'tour', kind: 'tour' })]
    const doc = blankDocument({ id: 'd1', eventId: 'tour', tags: ['show_on_phone'] })

    const missing = todayScreen(input({ events, docs: [doc] }))
    expect(missing.view.documents.map((d) => [d.documentId, d.availableOffline])).toEqual([
      ['d1', false],
    ])
    expect(missing.mascot).toBe('worried')

    const stale = todayScreen(
      input({ events, docs: [doc], blobs: [{ docId: 'd1', sha256: 'b'.repeat(64) }] })
    )
    expect(stale.mascot).toBe('worried')

    const saved = todayScreen(
      input({ events, docs: [doc], blobs: [{ docId: 'd1', sha256: doc.sha256! }] })
    )
    expect(saved.view.documents[0].availableOffline).toBe(true)
    expect(saved.mascot).toBe('happy')
  })

  it('mascot sleeps during the overnight train', () => {
    const train = placedEvent('2027-01-21T20:30', 'Asia/Bangkok', {
      id: 'night-train',
      kind: 'train',
      title: 'Night train',
      endsLocal: '2027-01-22T07:15',
    })
    const doc = blankDocument({ id: 'd1', eventId: 'night-train', tags: ['print'] })

    // 21:00 in Port Vellmar: before the night hours, but on board.
    const screen = todayScreen(
      input({ events: [train], docs: [doc], now: '2027-01-21T14:00:00.000Z' })
    )

    expect(screen.mascot).toBe('asleep')
    expect(screen.view.tonight?.eventId).toBe('night-train')
  })

  it('an overdue high task worries the mascot', () => {
    const screen = todayScreen(
      input({ tasks: [task({ id: 'visa', priority: 'high', dueOn: '2027-01-19' })] })
    )

    expect(screen.mascot).toBe('worried')
  })

  it('tonight is the lodging, or an alert when there is none', () => {
    const covered = todayScreen(
      input({
        events: [
          placedEvent('2027-01-21T15:00', 'Asia/Bangkok', {
            id: 'inn',
            kind: 'lodging',
            title: 'Harbour Inn',
            address: '14 Quay Lane',
            endsLocal: '2027-01-23T11:00',
          }),
        ],
      })
    )
    expect(covered.view.tonight).toMatchObject({ eventId: 'inn', address: '14 Quay Lane' })
    expect(covered.view.tonightAlert).toBe(false)

    const uncovered = todayScreen(input())
    expect(uncovered.view.tonight).toBeNull()
    expect(uncovered.view.tonightAlert).toBe(true)
  })

  it('before the trip the screen previews day 1, and the countdown runs from now', () => {
    const screen = todayScreen(
      input({
        now: '2027-01-10T05:00:00.000Z',
        events: [
          placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
            id: 'inn',
            kind: 'lodging',
            title: 'Harbour Inn',
            endsLocal: '2027-01-22T11:00',
          }),
        ],
        docs: [blankDocument({ id: 'd1', eventId: 'inn', tags: ['print'] })],
      })
    )

    expect(screen.preview).toBe(true)
    expect(screen.view.dayNumber).toBe(1)
    expect(screen.view.today).toBe('2027-01-20')
    expect(screen.view.tonight?.eventId).toBe('inn')
    expect(screen.view.documents.map((d) => d.documentId)).toEqual(['d1'])
    expect(screen.view.nextEvent?.eventId).toBe('inn')
    // 10 Jan 05:00 UTC to 20 Jan 08:00 UTC.
    expect(screen.view.nextEvent?.countdownMs).toBe((10 * 24 + 3) * 3_600_000)
  })

  it('maps the open print task of each document', () => {
    const screen = todayScreen(
      input({
        tasks: [
          task({ id: 'p1', origin: 'document', sourceDocumentId: 'd1' }),
          task({
            id: 'p2',
            origin: 'document',
            sourceDocumentId: 'd2',
            doneAt: '2027-01-19T00:00:00.000Z',
          }),
        ],
      })
    )

    expect(screen.printTasks).toEqual({ d1: 'p1' })
  })

  it('a link document is never offline', () => {
    const events = [placedEvent('2027-01-21T15:00', 'Asia/Bangkok', { id: 'tour', kind: 'tour' })]
    const link = blankDocument({
      id: 'l1',
      kind: 'link',
      url: 'https://example.com/ticket',
      sha256: null,
      eventId: 'tour',
      tags: ['show_on_phone'],
    })

    expect(todayScreen(input({ events, docs: [link] })).view.documents[0].availableOffline).toBe(
      false
    )
  })
})
