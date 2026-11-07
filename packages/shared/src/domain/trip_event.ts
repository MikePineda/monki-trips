/**
 * An itinerary event as the domain reads it: the row of `events` with its
 * instants already resolved to `ZonedInstant` (UTC instant plus the offset
 * of the zone at that instant). Transport events may carry segments; when
 * they do, the segments are what the domain reasons about.
 */
import type { IsoDate } from './iso_date.ts'
import type { MinorUnits } from './minor_units.ts'
import { localDate, type ZonedInstant } from './zoned_instant.ts'

export const EVENT_KINDS = [
  'flight',
  'train',
  'ferry',
  'bus',
  'car',
  'lodging',
  'tour',
  'meal',
  'activity',
  'free_time',
  'other',
] as const

export type EventKind = (typeof EVENT_KINDS)[number]

export const TRANSPORT_KINDS = ['flight', 'train', 'ferry', 'bus', 'car'] as const

export type TransportKind = (typeof TRANSPORT_KINDS)[number]

export const EVENT_STATUSES = ['idea', 'to_book', 'booked', 'paid', 'cancelled'] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

export interface EventSegment {
  id: string
  position: number
  carrier?: string | null
  number?: string | null
  /** IATA/UIC-style codes for the route chip; names are for display only. */
  originCode?: string | null
  originName?: string | null
  destinationCode?: string | null
  destinationName?: string | null
  departs: ZonedInstant
  arrives: ZonedInstant | null
}

export interface TripEvent {
  id: string
  kind: EventKind
  status: EventStatus
  title: string
  stopId?: string | null
  starts: ZonedInstant
  /** Null for an event without an end (a dinner, a note); such an event has no duration. */
  ends: ZonedInstant | null
  /** Explicit override of the night rule: true forces coverage, false forbids it, null applies the rule. */
  coversNight?: boolean | null
  leaveBufferMin?: number | null
  travelMin?: number | null
  placeName?: string | null
  address?: string | null
  addressLocal?: string | null
  phone?: string | null
  costMinor?: MinorUnits | null
  costCurrency?: string | null
  segments?: EventSegment[]
}

export function isTransportKind(kind: EventKind): kind is TransportKind {
  return (TRANSPORT_KINDS as readonly string[]).includes(kind)
}

/** Cancelled events and mere ideas are not part of the plan: they cover nothing and commit nothing. */
export function isActiveEvent(event: Pick<TripEvent, 'status'>): boolean {
  return event.status !== 'cancelled' && event.status !== 'idea'
}

/** The day an event belongs to: its local start date in the departure zone. */
export function eventDay(event: Pick<TripEvent, 'starts'>): IsoDate {
  return localDate(event.starts)
}

/** Segments sorted by position, or an empty list. */
export function sortedSegments(event: Pick<TripEvent, 'segments'>): EventSegment[] {
  return [...(event.segments ?? [])].sort((a, b) => a.position - b.position)
}
