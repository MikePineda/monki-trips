import {
  nightCoverage,
  type EventKind,
  type IsoDate,
  type NightCoverKind,
  type TripDates,
} from '@monkitrips/shared'
import { toDomainEvents, type EventRow, type SegmentRow } from './event-instants'

export interface NightCoverView {
  eventId: string
  kind: EventKind
  title: string
  how: NightCoverKind
}

export interface NightRow {
  date: IsoDate
  /** 1-based night of the trip. */
  number: number
  total: number
  covers: NightCoverView[]
  uncovered: boolean
}

export interface NightsView {
  rows: NightRow[]
  /** Nights with at least one lodging. */
  lodging: number
  /** Nights covered by transport (or an override) only. */
  onTheWay: number
  uncovered: number
}

/**
 * "Where we sleep": every night of the trip with what covers it, read
 * from the stored rows through the shared `night_coverage` pipeline. Pure.
 */
export function nightsView(
  trip: TripDates,
  events: readonly EventRow[],
  segments: readonly SegmentRow[]
): NightsView {
  const titles = new Map(events.map((event) => [event.id, event.title]))
  const report = nightCoverage(trip, toDomainEvents(events, segments))
  const rows = report.nights.map((night, index) => ({
    date: night.date,
    number: index + 1,
    total: report.nights.length,
    covers: night.coveredBy.map((cover) => ({
      eventId: cover.eventId,
      kind: cover.kind,
      title: titles.get(cover.eventId) ?? '',
      how: cover.how,
    })),
    uncovered: !night.covered,
  }))
  const lodging = rows.filter((row) => row.covers.some((cover) => cover.kind === 'lodging')).length
  return {
    rows,
    lodging,
    onTheWay: rows.filter((row) => !row.uncovered).length - lodging,
    uncovered: report.uncovered.length,
  }
}
