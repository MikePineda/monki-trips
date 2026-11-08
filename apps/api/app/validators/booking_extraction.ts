import vine from '@vinejs/vine'
import { BOOKING_KINDS, DEFAULT_BUDGET_CATEGORY_KEYS } from '@monkitrips/shared'
import { calendarDate } from '#validators/calendar_date'

/**
 * The shapes of reading a booking or a receipt: what the model must answer
 * (`bookingOutputValidator`, `receiptOutputValidator`, run by
 * `StructuredCompletion`, which sends any failure back once) and the
 * member's corrected draft (`reviseBookingValidator`). Unknown is `null`;
 * fields nobody asked for are dropped by VineJS, so a model cannot slip a
 * trip id or a tool name in.
 */

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/
const DECIMAL = /^-?\d+(?:\.\d+)?$/
const CURRENCY = /^[A-Za-z]{3}$/

const text = (max: number) => vine.string().trim().maxLength(max).nullable().optional()
const localTime = () => vine.string().trim().regex(LOCAL_TIME).nullable().optional()
const zone = () => vine.string().trim().maxLength(64).nullable().optional()
const paths = () =>
  vine.array(vine.string().trim().maxLength(64)).maxLength(60).nullable().optional()

const segment = vine.object({
  carrier: text(100),
  number: text(32),
  originName: text(200),
  originCode: text(8),
  destName: text(200),
  destCode: text(8),
  departsLocal: localTime(),
  departsTz: zone(),
  arrivesLocal: localTime(),
  arrivesTz: zone(),
})

const seat = vine.object({
  segment: vine.number().withoutDecimals().min(0).max(20).nullable().optional(),
  seat: text(16),
  coach: text(16),
})

const draftFields = () => ({
  kind: vine.enum(BOOKING_KINDS),
  title: text(200),
  providerName: text(200),
  bookingCode: text(64),
  segments: vine.array(segment).maxLength(12).nullable().optional(),
  startsLocal: localTime(),
  startTz: zone(),
  endsLocal: localTime(),
  endTz: zone(),
  placeName: text(200),
  address: text(500),
  addressLocal: text(500),
  cost: vine.string().trim().regex(DECIMAL).maxLength(20).nullable().optional(),
  costCurrency: vine.string().trim().regex(CURRENCY).nullable().optional(),
  seats: vine.array(seat).maxLength(20).nullable().optional(),
})

/** The model's answer for a booking: the draft plus the paths it is unsure of. */
export const bookingOutputValidator = vine.compile(
  vine.object({
    ...draftFields(),
    needsReview: paths(),
    lowConfidence: paths(),
  })
)

/** Body of `POST /trips/:tripId/ai/actions/:id/revise`. */
export const reviseBookingValidator = vine.compile(
  vine.object({ draft: vine.object(draftFields()) })
)

/** The model's answer for a receipt. */
export const receiptOutputValidator = vine.compile(
  vine.object({
    amount: vine.string().trim().regex(DECIMAL).maxLength(20).nullable().optional(),
    currency: vine.string().trim().regex(CURRENCY).nullable().optional(),
    spentOn: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .use(calendarDate())
      .nullable()
      .optional(),
    merchant: text(200),
    categoryKey: vine.enum(DEFAULT_BUDGET_CATEGORY_KEYS).nullable().optional(),
    needsReview: paths(),
    lowConfidence: paths(),
  })
)
