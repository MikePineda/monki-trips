import vine from '@vinejs/vine'
import { dateField } from '#validators/sync/fields'

/** `GET /trips/:tripId/weather?date=`: the trip day, a local calendar date. */
export const weatherQueryValidator = vine.compile(vine.object({ date: dateField }))
