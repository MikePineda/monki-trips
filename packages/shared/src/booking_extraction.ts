/**
 * Reading a booking or a receipt (WP 3.3). A member asks the app to read a
 * document of the trip (a booking PDF or a photo of it); the model returns
 * a `BookingDraft`, the server turns it into a proposal (`AiBookingProposal`,
 * an `ai_actions` row in `proposed`) and nothing is written until the
 * member accepts it. A receipt photo becomes a `ReceiptDraft` the quick
 * expense sheet fills in; the member saves it as a normal expense.
 *
 * The model never invents: what the file does not state is null, and the
 * fields a member must look at before accepting are listed in `review`.
 */
import type { AiEventChangesProposal } from './assistant.ts'

/** What a booking can be; every value is also an `EventKind`. */
export const BOOKING_KINDS = [
  'flight',
  'train',
  'ferry',
  'bus',
  'lodging',
  'tour',
  'other',
] as const

export type BookingKind = (typeof BOOKING_KINDS)[number]

/** Booking kinds that travel through segments (legs with departure and arrival). */
export const BOOKING_TRANSPORT_KINDS = ['flight', 'train', 'ferry', 'bus'] as const

/** Why a field is flagged in the review sheet. */
export const EXTRACTION_REVIEW_REASONS = ['needs_review', 'low_confidence', 'missing'] as const

export type ExtractionReviewReason = (typeof EXTRACTION_REVIEW_REASONS)[number]

/**
 * One field the member should check. `field` is a path into the draft:
 * `title`, `startTz`, `segments.0.departsLocal`, `seats.1.seat`.
 */
export interface ExtractionReviewFlag {
  field: string
  reason: ExtractionReviewReason
}

/** Local wall-clock time `YYYY-MM-DDTHH:mm`, read next to its IANA zone. */
export type DraftLocalTime = string

/** One leg of a transport booking. */
export interface BookingSegmentDraft {
  carrier: string | null
  /** Flight or train number as printed. */
  number: string | null
  originName: string | null
  /** IATA or station code when printed. */
  originCode: string | null
  destName: string | null
  destCode: string | null
  departsLocal: DraftLocalTime | null
  departsTz: string | null
  arrivesLocal: DraftLocalTime | null
  arrivesTz: string | null
}

/** A seat line as printed; travellers are never named here. */
export interface BookingSeatDraft {
  /** Index into `segments`, or null when the booking does not say. */
  segment: number | null
  seat: string | null
  coach: string | null
}

export interface BookingDraft {
  kind: BookingKind
  title: string | null
  providerName: string | null
  bookingCode: string | null
  /** Transport legs in travel order; empty for lodging, tours and the rest. */
  segments: BookingSegmentDraft[]
  /** Start of a non-transport booking (check-in of a lodging, start of a tour). */
  startsLocal: DraftLocalTime | null
  startTz: string | null
  /** End of a non-transport booking (check-out of a lodging). */
  endsLocal: DraftLocalTime | null
  endTz: string | null
  placeName: string | null
  address: string | null
  /** The address in the local script, for taxis. */
  addressLocal: string | null
  /** Total cost as a decimal in major units (`1234.50`), with its ISO 4217 currency. */
  cost: string | null
  costCurrency: string | null
  seats: BookingSeatDraft[]
}

/** Where a draft came from: the PDF's text (cheap model) or the file itself (vision model). */
export const EXTRACTION_SOURCES = ['text', 'vision'] as const

export type ExtractionSource = (typeof EXTRACTION_SOURCES)[number]

/** `ai_actions.proposal` of an `extract_booking` action. */
export interface AiBookingProposal {
  kind: 'booking'
  /** The document the booking was read from; accepting links it to the event. */
  documentId: string | null
  /** The id the new event gets on accept. */
  eventId: string
  source: ExtractionSource
  draft: BookingDraft
  review: ExtractionReviewFlag[]
  /** The event as it would be added, and the nights whose cover changes. */
  changes: AiEventChangesProposal
}

/** `POST /trips/:tripId/ai/actions/:id/revise` body: the member's corrected draft. */
export interface ReviseBookingRequest {
  draft: BookingDraft
}

/** What a receipt photo says; the quick expense sheet shows it for confirmation. */
export interface ReceiptDraft {
  /** Decimal in major units (`450`, `12.90`); negative for a refund. */
  amount: string | null
  currency: string | null
  spentOn: string | null
  merchant: string | null
  /** A default category key (`food`), or null when unsure. */
  categoryKey: string | null
  review: ExtractionReviewFlag[]
}

/** Largest image (or scanned PDF) sent to the vision model. */
export const EXTRACTION_MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Pages of a PDF that are read; a scanned PDF with more is refused. */
export const EXTRACTION_MAX_PDF_PAGES = 10

/** Characters of PDF text sent to the model. */
export const EXTRACTION_MAX_TEXT_CHARS = 20_000

/** The longest side of a receipt photo after the client downscales it. */
export const RECEIPT_MAX_IMAGE_SIDE_PX = 1600

/** Image types the vision model reads. */
export const EXTRACTION_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const
