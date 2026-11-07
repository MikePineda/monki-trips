import { DateTime } from 'luxon'
import {
  TRANSPORT_KINDS,
  type EventKind,
  type EventStatus,
  type TripNight,
} from '@monkitrips/shared'

/** The slice of an event the night rules read. */
export interface NightEvent {
  id: string
  kind: EventKind
  status: EventStatus
  title: string
  /** Local start date (`YYYY-MM-DD`), check-in for a lodging. */
  startsOn: string | null
  /** Local end date (`YYYY-MM-DD`), check-out for a lodging. */
  endsOn: string | null
  startsAt: string | null
  endsAt: string | null
  /** IANA zone of the departure; the night's "01:00" and "05:00" are read in it. */
  startTz: string | null
  coversNight: boolean | null
}

export interface NightCoverageInput {
  startsOn: string
  endsOn: string
  homeTz: string
  events: NightEvent[]
}

/** Statuses that never put a roof over anyone's head. */
const NEVER_COVERS: ReadonlySet<EventStatus> = new Set(['cancelled', 'idea'])

/** Every night of the trip: the day it starts on, from `startsOn` to the day before `endsOn`. */
export function nightsOf(startsOn: string, endsOn: string): string[] {
  const nights: string[] = []
  let day = DateTime.fromISO(startsOn, { zone: 'utc' })
  const last = DateTime.fromISO(endsOn, { zone: 'utc' })
  while (day < last) {
    nights.push(day.toISODate()!)
    day = day.plus({ days: 1 })
  }
  return nights
}

/**
 * Whether one event covers the night that starts on `date`. A lodging
 * covers it when check-in <= date < check-out. A transport covers it when it
 * departs by 01:00 and arrives after 05:00 of the next morning, both read in
 * the departure zone (an overnight train, a red-eye landing at dawn). A
 * late flight landing at 02:00 leaves the night uncovered. `coversNight`
 * forces either answer; cancelled events and ideas never cover.
 */
export function eventCoversNight(event: NightEvent, date: string, homeTz: string): boolean {
  if (NEVER_COVERS.has(event.status)) return false
  if (event.coversNight === false) return false
  if (event.kind === 'lodging') {
    if (event.coversNight === true) return true
    return !!event.startsOn && !!event.endsOn && event.startsOn <= date && date < event.endsOn
  }
  if (!(TRANSPORT_KINDS as readonly string[]).includes(event.kind)) return false
  if (!event.startsAt || !event.endsAt) return false
  const zone = event.startTz ?? homeTz
  const nextMorning = DateTime.fromISO(date, { zone }).plus({ days: 1 })
  const departsBy = nextMorning.set({ hour: 1, minute: 0, second: 0, millisecond: 0 })
  const arrivesAfter = nextMorning.set({ hour: 5, minute: 0, second: 0, millisecond: 0 })
  const departs = DateTime.fromISO(event.startsAt)
  const arrives = DateTime.fromISO(event.endsAt)
  const spansTheNight = departs <= departsBy && arrives >= arrivesAfter
  if (event.coversNight === true) {
    // Forced: the event covers the night it departs on (or the nights it spans).
    const departsOn = departs.setZone(zone).toISODate()!
    const arrivesOn = arrives.setZone(zone).toISODate()!
    return departsOn <= date && date < arrivesOn ? true : spansTheNight || departsOn === date
  }
  return spansTheNight
}

/** Where everyone sleeps each night of the trip, lodging first when both a hotel and a train apply. */
export function nightCoverage(input: NightCoverageInput): TripNight[] {
  const live = input.events.filter((event) => !NEVER_COVERS.has(event.status))
  return nightsOf(input.startsOn, input.endsOn).map((date) => {
    const lodging = live.find(
      (event) => event.kind === 'lodging' && eventCoversNight(event, date, input.homeTz)
    )
    const coveredBy =
      lodging ?? live.find((event) => eventCoversNight(event, date, input.homeTz)) ?? null
    return {
      date,
      covered: coveredBy !== null,
      coveredBy: coveredBy
        ? { eventId: coveredBy.id, kind: coveredBy.kind, title: coveredBy.title }
        : null,
    }
  })
}
