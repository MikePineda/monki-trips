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

/** Body of `PUT /me/notification-settings`: every field, the quiet hours as a pair. */
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
)
