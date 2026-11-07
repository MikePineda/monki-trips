import vine from '@vinejs/vine'
import { BUDGET_MODES } from '@monkitrips/shared'
import { timezoneSchema } from '#validators/auth'

/** `YYYY-MM-DD`, kept as a string: trip dates are plain dates in the trip's zone. */
export const isoDateSchema = vine
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)

export const createTripValidator = vine.compile(
  vine.object({
    id: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(120),
    baseCurrency: vine
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema,
    homeTz: timezoneSchema.optional(),
    budgetMode: vine.enum(BUDGET_MODES).optional(),
    budgetTotalMinor: vine.number().withoutDecimals().min(0).nullable().optional(),
  })
)
