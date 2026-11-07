import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

/**
 * A `YYYY-MM-DD` string that names a real day on the calendar. The format
 * regex alone lets `2026-02-30` through, which Postgres then rejects with a
 * 500; this rule answers 422 `calendarDate` instead. Run it after the regex.
 */
export const calendarDate = vine.createRule(
  (value, _options, field) => {
    if (typeof value !== 'string') return
    if (!DateTime.fromISO(value, { zone: 'utc' }).isValid) {
      field.report('{{ field }} must be a real date', 'calendarDate', field)
    }
  },
  { name: 'calendarDate' }
)
