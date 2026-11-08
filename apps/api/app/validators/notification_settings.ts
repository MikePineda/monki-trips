import vine from '@vinejs/vine'

/** A local wall clock `HH:MM`, 00:00 to 23:59. */
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

const localTime = () => vine.string().trim().regex(HH_MM).nullable()

/** Quiet hours come in pairs: both ends set or both null. */
const quietHoursPair = vine.createRule(
  (value, _options, field) => {
    if (typeof value !== 'object' || value === null) return
    const { quietHoursStart: start, quietHoursEnd: end } = value as Record<string, unknown>
    if ((start === null) === (end === null)) return
    field.report('Quiet hours need both a start and an end', 'quietHoursPair', field)
  },
  { name: 'quietHoursPair' }
)

/** Quiet hours starting and ending at the same minute have no length: rejected, never read as all day. */
const quietHoursDistinct = vine.createRule(
  (value, _options, field) => {
    if (typeof value !== 'object' || value === null) return
    const { quietHoursStart: start, quietHoursEnd: end } = value as Record<string, unknown>
    if (start === null || start === undefined || start !== end) return
    field.report('Quiet hours need a start and an end that differ', 'quietHoursDistinct', field)
  },
  { name: 'quietHoursDistinct' }
)

/** Body of `PUT /me/notification-settings`: every field, the quiet hours as a pair of different times. */
export const notificationSettingsValidator = vine.compile(
  vine
    .object({
      leaveAt: vine.boolean({ strict: true }),
      checkOut: vine.boolean({ strict: true }),
      tasksDue: vine.boolean({ strict: true }),
      quietHoursStart: localTime(),
      quietHoursEnd: localTime(),
    })
    .use(quietHoursPair())
    .use(quietHoursDistinct())
)
