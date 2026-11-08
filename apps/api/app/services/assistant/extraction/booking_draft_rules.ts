import {
  BOOKING_TRANSPORT_KINDS,
  majorAmountToMinor,
  minorUnitExponent,
  type BookingDraft,
  type BookingSeatDraft,
  type BookingSegmentDraft,
  type ExtractionReviewFlag,
} from '@monkitrips/shared'
import { isValidZone, localTimeToInstant } from '#domain/local_time'

/**
 * The rules of a booking draft, pure: no ORM, no clock, no I/O. A draft is
 * what the model read from a booking (or what the member corrected); these
 * functions normalise it, list its problems as field paths and rules
 * (never values), and decide which fields the member must look at.
 */

/** A field problem: a path into the draft (`segments.0.departsTz`) and a rule name. */
export interface DraftProblem {
  field: string
  rule: string
}

/** What the model itself said it was unsure about, as draft paths. */
export interface ModelFlags {
  needsReview?: string[] | null
  lowConfidence?: string[] | null
}

const SEGMENT_FIELDS = [
  'carrier',
  'number',
  'originName',
  'originCode',
  'destName',
  'destCode',
  'departsLocal',
  'departsTz',
  'arrivesLocal',
  'arrivesTz',
] as const

const TOP_FIELDS = [
  'kind',
  'title',
  'providerName',
  'bookingCode',
  'startsLocal',
  'startTz',
  'endsLocal',
  'endTz',
  'placeName',
  'address',
  'addressLocal',
  'cost',
  'costCurrency',
] as const

const SEAT_FIELDS = ['segment', 'seat', 'coach'] as const

export function emptySegment(): BookingSegmentDraft {
  return {
    carrier: null,
    number: null,
    originName: null,
    originCode: null,
    destName: null,
    destCode: null,
    departsLocal: null,
    departsTz: null,
    arrivesLocal: null,
    arrivesTz: null,
  }
}

export function isTransportBooking(draft: Pick<BookingDraft, 'kind'>): boolean {
  return (BOOKING_TRANSPORT_KINDS as readonly string[]).includes(draft.kind)
}

type Loose<T> = { [K in keyof T]?: T[K] | null | undefined }

export type LooseDraft = Omit<Loose<BookingDraft>, 'kind' | 'segments' | 'seats'> & {
  kind: BookingDraft['kind']
  segments?: Loose<BookingSegmentDraft>[] | null
  seats?: Loose<BookingSeatDraft>[] | null
}

/** Text trimmed, empty as null. */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** A local time cut to minutes (`YYYY-MM-DDTHH:mm`); seconds are noise on a booking. */
function local(value: unknown): string | null {
  const trimmed = text(value)
  return trimmed ? trimmed.slice(0, 16) : null
}

/** Every field present, `null` for what is not known; local times to the minute; codes upper case. */
export function normalizeDraft(raw: LooseDraft): BookingDraft {
  const currency = text(raw.costCurrency)
  return {
    kind: raw.kind,
    title: text(raw.title),
    providerName: text(raw.providerName),
    bookingCode: text(raw.bookingCode),
    segments: (raw.segments ?? []).map((segment) => ({
      carrier: text(segment.carrier),
      number: text(segment.number),
      originName: text(segment.originName),
      originCode: text(segment.originCode),
      destName: text(segment.destName),
      destCode: text(segment.destCode),
      departsLocal: local(segment.departsLocal),
      departsTz: text(segment.departsTz),
      arrivesLocal: local(segment.arrivesLocal),
      arrivesTz: text(segment.arrivesTz),
    })),
    startsLocal: local(raw.startsLocal),
    startTz: text(raw.startTz),
    endsLocal: local(raw.endsLocal),
    endTz: text(raw.endTz),
    placeName: text(raw.placeName),
    address: text(raw.address),
    addressLocal: text(raw.addressLocal),
    cost: text(raw.cost),
    costCurrency: currency ? currency.toUpperCase() : null,
    seats: (raw.seats ?? []).map((seat) => ({
      segment: typeof seat.segment === 'number' ? seat.segment : null,
      seat: text(seat.seat),
      coach: text(seat.coach),
    })),
  }
}

/** Every field path a draft has, in display order. */
export function draftPaths(draft: BookingDraft): string[] {
  return [
    ...TOP_FIELDS,
    ...draft.segments.flatMap((_, index) => SEGMENT_FIELDS.map((f) => `segments.${index}.${f}`)),
    ...draft.seats.flatMap((_, index) => SEAT_FIELDS.map((f) => `seats.${index}.${f}`)),
  ]
}

/** The value at a draft path, or undefined for a path the draft does not have. */
export function draftValueAt(draft: BookingDraft, path: string): unknown {
  const [head, index, leaf] = path.split('.')
  if (head === 'segments' || head === 'seats') {
    const list = draft[head] as unknown as Record<string, unknown>[]
    const row = list[Number(index)]
    return row && leaf in row ? row[leaf] : undefined
  }
  return head in draft && path === head
    ? (draft as unknown as Record<string, unknown>)[head]
    : undefined
}

/** One local time and its zone, checked together. */
function checkTime(
  problems: DraftProblem[],
  prefix: string,
  localField: string,
  zoneField: string,
  localValue: string | null,
  zone: string | null
): string | null {
  if (zone !== null && !isValidZone(zone)) {
    problems.push({ field: `${prefix}${zoneField}`, rule: 'timezone' })
    return null
  }
  if (localValue === null || zone === null) return null
  const derived = localTimeToInstant(localValue, zone)
  if (!derived.ok) {
    problems.push({
      field: `${prefix}${localField}`,
      rule: derived.reason === 'nonexistent' ? 'nonexistentLocalTime' : 'regex',
    })
    return null
  }
  return derived.at
}

/**
 * What would stop the draft from being applied, or makes it contradict
 * itself: an unknown zone, a local time that is malformed or does not
 * exist in its zone (a daylight-saving gap), an arrival before its
 * departure, an amount the currency cannot hold, a seat on a leg that does
 * not exist. Unknown values (null) are never a problem.
 */
export function draftProblems(draft: BookingDraft): DraftProblem[] {
  const problems: DraftProblem[] = []
  draft.segments.forEach((segment, index) => {
    const prefix = `segments.${index}.`
    const departs = checkTime(
      problems,
      prefix,
      'departsLocal',
      'departsTz',
      segment.departsLocal,
      segment.departsTz
    )
    const arrives = checkTime(
      problems,
      prefix,
      'arrivesLocal',
      'arrivesTz',
      segment.arrivesLocal,
      segment.arrivesTz
    )
    if (departs && arrives && arrives < departs) {
      problems.push({ field: `${prefix}arrivesLocal`, rule: 'afterOrEqual' })
    }
  })
  const starts = checkTime(problems, '', 'startsLocal', 'startTz', draft.startsLocal, draft.startTz)
  const ends = checkTime(
    problems,
    '',
    'endsLocal',
    'endTz',
    draft.endsLocal,
    draft.endTz ?? draft.startTz
  )
  if (starts && ends && ends < starts) problems.push({ field: 'endsLocal', rule: 'afterOrEqual' })
  if (draft.costCurrency !== null && !minorUnitExponent(draft.costCurrency).known) {
    problems.push({ field: 'costCurrency', rule: 'currency' })
  } else if (
    draft.cost !== null &&
    majorAmountToMinor(draft.cost, draft.costCurrency ?? 'XXX') === null
  ) {
    problems.push({ field: 'cost', rule: 'amount' })
  }
  draft.seats.forEach((seat, index) => {
    if (seat.segment !== null && (seat.segment < 0 || seat.segment >= draft.segments.length)) {
      problems.push({ field: `seats.${index}.segment`, rule: 'range' })
    }
  })
  return problems
}

/** The flags the app adds on its own: what a booking needs and the draft does not say. */
function appFlags(draft: BookingDraft): ExtractionReviewFlag[] {
  const flags: ExtractionReviewFlag[] = []
  const missing = (field: string) => flags.push({ field, reason: 'missing' })
  const zoneless = (field: string) => flags.push({ field, reason: 'needs_review' })
  if (draft.title === null) missing('title')
  draft.segments.forEach((segment, index) => {
    const prefix = `segments.${index}.`
    for (const [localField, zoneField] of [
      ['departsLocal', 'departsTz'],
      ['arrivesLocal', 'arrivesTz'],
    ] as const) {
      if (segment[localField] === null) missing(prefix + localField)
      else if (segment[zoneField] === null) zoneless(prefix + zoneField)
    }
  })
  if (!isTransportBooking(draft)) {
    if (draft.startsLocal === null) missing('startsLocal')
    else if (draft.startTz === null) zoneless('startTz')
    if (draft.endsLocal !== null && draft.endTz === null && draft.startTz === null) {
      zoneless('endTz')
    }
  }
  if (draft.cost !== null && draft.costCurrency === null) missing('costCurrency')
  return flags
}

/**
 * The fields the review sheet flags: the app's own (`missing`, a time
 * without its zone) first, then what the model said it was unsure about,
 * kept only for paths the draft has (anything else the model wrote is
 * dropped), one flag per field.
 */
export function draftReviewFlags(draft: BookingDraft, model: ModelFlags): ExtractionReviewFlag[] {
  const paths = new Set(draftPaths(draft))
  const flags = appFlags(draft)
  const add = (field: string, reason: ExtractionReviewFlag['reason']) => {
    if (!paths.has(field) || flags.some((flag) => flag.field === field)) return
    flags.push({ field, reason })
  }
  for (const field of model.needsReview ?? []) add(field, 'needs_review')
  for (const field of model.lowConfidence ?? []) add(field, 'low_confidence')
  return flags
}

/**
 * The flags after the member corrected the draft: a model flag stays only
 * while its field still holds what the model read; the app's own flags are
 * computed again on the new draft.
 */
export function revisedReviewFlags(
  before: BookingDraft,
  flags: ExtractionReviewFlag[],
  after: BookingDraft
): ExtractionReviewFlag[] {
  const kept = flags.filter(
    (flag) =>
      flag.reason !== 'missing' &&
      draftValueAt(after, flag.field) !== undefined &&
      draftValueAt(after, flag.field) === draftValueAt(before, flag.field)
  )
  const fresh = appFlags(after)
  const result = [...fresh]
  for (const flag of kept) {
    if (!result.some((one) => one.field === flag.field)) result.push(flag)
  }
  return result
}
