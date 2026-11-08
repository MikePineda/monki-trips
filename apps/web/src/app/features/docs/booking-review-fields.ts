import { BOOKING_TRANSPORT_KINDS, type BookingDraft } from '@monkitrips/shared'

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

/**
 * The blocks of fields the review sheet shows for a draft, in reading
 * order: the booking itself, each leg (transport) or the start and end
 * (everything else), the place, the cost and each seat line. Pure.
 */
export function bookingReviewGroups(draft: BookingDraft): BookingReviewGroup[] {
  const groups: BookingReviewGroup[] = [
    {
      id: 'booking',
      title: 'booking',
      n: null,
      fields: [
        text('title', 'title'),
        text('providerName', 'providerName'),
        code('bookingCode', 'bookingCode'),
      ],
    },
  ]
  draft.segments.forEach((_, index) => {
    const at = `segments.${index}`
    groups.push({
      id: at,
      title: 'segment',
      n: index + 1,
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
  if (!isTransportKind(draft.kind)) {
    groups.push({
      id: 'when',
      title: 'when',
      n: null,
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
      fields: [text('cost', 'cost'), code('costCurrency', 'costCurrency')],
    }
  )
  draft.seats.forEach((_, index) => {
    const at = `seats.${index}`
    groups.push({
      id: at,
      title: 'seat',
      n: index + 1,
      fields: [code(`${at}.seat`, 'seat'), code(`${at}.coach`, 'coach')],
    })
  })
  return groups
}
