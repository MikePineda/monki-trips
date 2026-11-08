import {
  BOOKING_TRANSPORT_KINDS,
  type BookingDraft,
  type BookingSegmentDraft,
} from '@monkitrips/shared'

export type BookingFieldInput = 'text' | 'code' | 'datetime-local'

/** One editable field of the review sheet: its draft path and how it reads. */
export interface BookingReviewField {
  path: string
  /** Key under `docs.review.field`. */
  label: string
  input: BookingFieldInput
}

/** A titled block of fields (`docs.review.group.<title>`, with `n` for legs and seats). */
export interface BookingReviewGroup {
  id: string
  title: string
  n: number | null
  fields: BookingReviewField[]
  /** A leg that accept would skip: it lacks a time or a zone at either end. */
  unsaved: boolean
}

const text = (path: string, label: string): BookingReviewField => ({ path, label, input: 'text' })
const code = (path: string, label: string): BookingReviewField => ({ path, label, input: 'code' })
const time = (path: string, label: string): BookingReviewField => ({
  path,
  label,
  input: 'datetime-local',
})

export function isTransportKind(kind: string): boolean {
  return (BOOKING_TRANSPORT_KINDS as readonly string[]).includes(kind)
}

const filled = (value: string | null): boolean => value !== null && value.trim() !== ''

/** Whether accept saves this leg: both local times and both zones are stated. */
export function legSaved(
  segment: Pick<BookingSegmentDraft, 'departsLocal' | 'departsTz' | 'arrivesLocal' | 'arrivesTz'>
): boolean {
  return (
    filled(segment.departsLocal) &&
    filled(segment.departsTz) &&
    filled(segment.arrivesLocal) &&
    filled(segment.arrivesTz)
  )
}

/**
 * The blocks of fields the review sheet shows for a draft, in reading
 * order: the booking itself, each leg (transport, flagged when accept
 * would skip it) or the start and end (everything else: its legs are
 * ignored on accept, so they are not shown), the place, the cost and each
 * seat line. Pure.
 */
export function bookingReviewGroups(draft: BookingDraft): BookingReviewGroup[] {
  const groups: BookingReviewGroup[] = [
    {
      id: 'booking',
      title: 'booking',
      n: null,
      unsaved: false,
      fields: [
        text('title', 'title'),
        text('providerName', 'providerName'),
        code('bookingCode', 'bookingCode'),
      ],
    },
  ]
  const transport = isTransportKind(draft.kind)
  const legs = transport ? draft.segments : []
  legs.forEach((segment, index) => {
    const at = `segments.${index}`
    groups.push({
      id: at,
      title: 'segment',
      n: index + 1,
      unsaved: !legSaved(segment),
      fields: [
        text(`${at}.carrier`, 'carrier'),
        code(`${at}.number`, 'number'),
        text(`${at}.originName`, 'originName'),
        code(`${at}.originCode`, 'originCode'),
        text(`${at}.destName`, 'destName'),
        code(`${at}.destCode`, 'destCode'),
        time(`${at}.departsLocal`, 'departsLocal'),
        text(`${at}.departsTz`, 'departsTz'),
        time(`${at}.arrivesLocal`, 'arrivesLocal'),
        text(`${at}.arrivesTz`, 'arrivesTz'),
      ],
    })
  })
  if (!transport) {
    groups.push({
      id: 'when',
      title: 'when',
      n: null,
      unsaved: false,
      fields: [
        time('startsLocal', 'startsLocal'),
        text('startTz', 'startTz'),
        time('endsLocal', 'endsLocal'),
        text('endTz', 'endTz'),
      ],
    })
  }
  groups.push(
    {
      id: 'place',
      title: 'place',
      n: null,
      unsaved: false,
      fields: [
        text('placeName', 'placeName'),
        text('address', 'address'),
        text('addressLocal', 'addressLocal'),
      ],
    },
    {
      id: 'cost',
      title: 'cost',
      n: null,
      unsaved: false,
      fields: [text('cost', 'cost'), code('costCurrency', 'costCurrency')],
    }
  )
  draft.seats.forEach((_, index) => {
    const at = `seats.${index}`
    groups.push({
      id: at,
      title: 'seat',
      n: index + 1,
      unsaved: false,
      fields: [code(`${at}.seat`, 'seat'), code(`${at}.coach`, 'coach')],
    })
  })
  return groups
}
