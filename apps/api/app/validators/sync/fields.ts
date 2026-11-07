import vine from '@vinejs/vine'
import { IANAZone } from 'luxon'
import { calendarDate } from '#validators/calendar_date'
import { parseIsoInstant } from '#domain/iso_instant'

/**
 * Field schemas shared by the sync entity validators. Every field of a
 * `changes` object is optional (a mutation carries only what changed); the
 * applier checks what an insert must carry.
 */

/** `YYYY-MM-DD` of a real day. */
export const dateField = vine
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .use(calendarDate())

/** `YYYY-MM-DDTHH:mm[:ss]`, a wall-clock time without a zone; the zone travels in its own field. */
export const localTimeField = vine
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)

/** An IANA zone Luxon can resolve (`UTC` and the `Etc/*` names included, unlike `Intl.supportedValuesOf`). */
export const timezone = vine.createRule(
  (value, _options, field) => {
    if (typeof value !== 'string') return
    if (!IANAZone.isValidZone(value)) {
      field.report('{{ field }} must be a known time zone', 'timezone', field)
    }
  },
  { name: 'timezone' }
)
export const zoneField = vine.string().trim().use(timezone())

/** ISO 4217 code, uppercase. */
export const currencyField = vine
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/)

/** ISO 3166-1 alpha-2, uppercase. */
export const countryField = vine
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/)

/**
 * Integer minor units, a fresh schema each time (VineJS builders mutate when
 * chained). Capped at the safe integer range: beyond it a JSON number has
 * already lost digits, and the bigint columns would overflow.
 */
export const minorField = () =>
  vine.number().withoutDecimals().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)

export const latField = vine.number().min(-90).max(90)
export const lngField = vine.number().min(-180).max(180)

export const shortText = vine.string().trim().minLength(1).maxLength(200)
export const longText = vine.string().trim().maxLength(5000)

/** A decimal string with at least one non-zero digit (`0`, `0.000` are not rates). */
const positiveDecimal = vine.createRule(
  (value, _options, field) => {
    if (typeof value !== 'string') return
    if (!/[1-9]/.test(value)) {
      field.report('{{ field }} must be greater than zero', 'positive', field)
    }
  },
  { name: 'positive' }
)

/** A positive decimal with up to ten decimals, as a string: a rate never travels as a float. */
export const rateField = vine
  .string()
  .trim()
  .regex(/^\d{1,13}(\.\d{1,10})?$/)
  .use(positiveDecimal())

/** The id of a row in the same trip (the applier checks it exists and is live). */
export const refField = vine.string().uuid()

/** An ISO instant, read the way the services read it (`parseIsoInstant`). */
export const instantField = vine
  .string()
  .trim()
  .use(
    vine.createRule(
      (value, _options, field) => {
        if (typeof value !== 'string') return
        if (!parseIsoInstant(value)) {
          field.report('{{ field }} must be an ISO date-time', 'instant', field)
        }
      },
      { name: 'instant' }
    )()
  )
