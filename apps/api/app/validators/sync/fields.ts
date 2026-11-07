import vine from '@vinejs/vine'
import { DateTime, IANAZone } from 'luxon'
import { calendarDate } from '#validators/calendar_date'

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

/** Integer minor units, a fresh schema each time (VineJS builders mutate when chained). */
export const minorField = () => vine.number().withoutDecimals()

export const latField = vine.number().min(-90).max(90)
export const lngField = vine.number().min(-180).max(180)

export const shortText = vine.string().trim().minLength(1).maxLength(200)
export const longText = vine.string().trim().maxLength(5000)

/** A positive decimal with up to ten decimals, as a string: a rate never travels as a float. */
export const rateField = vine
  .string()
  .trim()
  .regex(/^\d{1,13}(\.\d{1,10})?$/)

/** The id of a row in the same trip (the applier checks it exists and is live). */
export const refField = vine.string().uuid()

/** An ISO instant. */
export const instantField = vine
  .string()
  .trim()
  .use(
    vine.createRule(
      (value, _options, field) => {
        if (typeof value !== 'string') return
        if (!DateTime.fromISO(value).isValid) {
          field.report('{{ field }} must be an ISO date-time', 'instant', field)
        }
      },
      { name: 'instant' }
    )()
  )
