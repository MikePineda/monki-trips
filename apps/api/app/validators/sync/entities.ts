import vine from '@vinejs/vine'
import {
  BUDGET_MODES,
  EXPENSE_KINDS,
  DOCUMENT_KINDS,
  DOCUMENT_TAGS,
  EVENT_KINDS,
  EVENT_STATUSES,
  FX_SOURCES,
  PRE_TRIP_TEMPLATE_KEYS,
  TASK_PRIORITIES,
} from '@monkitrips/shared'
import {
  countryField,
  currencyField,
  dateField,
  instantField,
  latField,
  lngField,
  localTimeField,
  longText,
  minorField,
  rateField,
  refField,
  shortText,
  zoneField,
} from '#validators/sync/fields'

/**
 * The `changes` a mutation may carry, per entity. Every field is optional
 * and most are nullable; anything not listed here (derived values such as
 * `startsAt`, server-owned values such as `storageKey`) is dropped before
 * the merge, so a client can never set it.
 */

export const tripChanges = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    baseCurrency: currencyField.optional(),
    budgetMode: vine.enum(BUDGET_MODES).optional(),
    budgetTotalMinor: minorField().min(0).nullable().optional(),
    startsOn: dateField.optional(),
    endsOn: dateField.optional(),
    homeTz: zoneField.optional(),
  })
)

export const travellerChanges = vine.compile(
  vine.object({
    displayName: vine.string().trim().minLength(1).maxLength(80).optional(),
    position: vine.number().withoutDecimals().min(0).optional(),
  })
)

export const stopChanges = vine.compile(
  vine.object({
    position: vine.number().withoutDecimals().min(0).optional(),
    name: shortText.optional(),
    countryCode: countryField.nullable().optional(),
    lat: latField.nullable().optional(),
    lng: lngField.nullable().optional(),
    tz: zoneField.nullable().optional(),
    arriveOn: dateField.nullable().optional(),
    departOn: dateField.nullable().optional(),
  })
)

export const eventChanges = vine.compile(
  vine.object({
    stopId: refField.nullable().optional(),
    kind: vine.enum(EVENT_KINDS).optional(),
    title: shortText.optional(),
    status: vine.enum(EVENT_STATUSES).optional(),
    startsLocal: localTimeField.nullable().optional(),
    startTz: zoneField.nullable().optional(),
    endsLocal: localTimeField.nullable().optional(),
    endTz: zoneField.nullable().optional(),
    placeName: shortText.nullable().optional(),
    address: longText.nullable().optional(),
    addressLocal: longText.nullable().optional(),
    lat: latField.nullable().optional(),
    lng: lngField.nullable().optional(),
    providerName: shortText.nullable().optional(),
    bookingCode: vine.string().trim().maxLength(100).nullable().optional(),
    costMinor: minorField().nullable().optional(),
    costCurrency: currencyField.nullable().optional(),
    notes: longText.nullable().optional(),
    leaveBufferMin: vine.number().withoutDecimals().min(0).max(1440).nullable().optional(),
    travelMin: vine.number().withoutDecimals().min(0).max(1440).nullable().optional(),
    coversNight: vine.boolean().nullable().optional(),
  })
)

export const segmentChanges = vine.compile(
  vine.object({
    eventId: refField.optional(),
    position: vine.number().withoutDecimals().min(0).optional(),
    carrier: shortText.nullable().optional(),
    number: vine.string().trim().maxLength(20).nullable().optional(),
    originName: shortText.nullable().optional(),
    originCode: vine.string().trim().maxLength(10).nullable().optional(),
    originLat: latField.nullable().optional(),
    originLng: lngField.nullable().optional(),
    destName: shortText.nullable().optional(),
    destCode: vine.string().trim().maxLength(10).nullable().optional(),
    destLat: latField.nullable().optional(),
    destLng: lngField.nullable().optional(),
    departsLocal: localTimeField.optional(),
    departsTz: zoneField.optional(),
    arrivesLocal: localTimeField.optional(),
    arrivesTz: zoneField.optional(),
  })
)

export const seatChanges = vine.compile(
  vine.object({
    segmentId: refField.optional(),
    travellerId: refField.optional(),
    seat: vine.string().trim().maxLength(10).nullable().optional(),
    coach: vine.string().trim().maxLength(10).nullable().optional(),
    ticketNumber: vine.string().trim().maxLength(50).nullable().optional(),
    documentId: refField.nullable().optional(),
  })
)

export const documentChanges = vine.compile(
  vine.object({
    eventId: refField.nullable().optional(),
    kind: vine.enum(DOCUMENT_KINDS).optional(),
    title: shortText.optional(),
    url: vine
      .string()
      .trim()
      .url({ protocols: ['http', 'https'] })
      .maxLength(2000)
      .nullable()
      .optional(),
    tags: vine.array(vine.enum(DOCUMENT_TAGS)).distinct().optional(),
    availableOffline: vine.boolean().optional(),
  })
)

/**
 * Origins a client may give a task it creates: its own (`manual`) or a
 * checklist item (`template`, with the item's key). `document` and `ai`
 * tasks are made by the server (print tasks, accepted AI actions).
 */
export const CLIENT_TASK_ORIGINS = ['manual', 'template'] as const

export const taskChanges = vine.compile(
  vine.object({
    eventId: refField.nullable().optional(),
    title: shortText.optional(),
    notes: longText.nullable().optional(),
    dueOn: dateField.nullable().optional(),
    priority: vine.enum(TASK_PRIORITIES).optional(),
    doneAt: instantField.nullable().optional(),
    origin: vine.enum(CLIENT_TASK_ORIGINS).optional(),
    // Only with origin `template`; the entity enforces it and derives `titleKey` from the key.
    templateItemKey: vine.enum(PRE_TRIP_TEMPLATE_KEYS).optional(),
    titleKey: vine.string().trim().minLength(1).maxLength(120).optional(),
  })
)

export const budgetCategoryChanges = vine.compile(
  vine.object({
    key: vine.string().trim().minLength(1).maxLength(40).nullable().optional(),
    name: shortText.nullable().optional(),
    budgetMinor: minorField().min(0).nullable().optional(),
    position: vine.number().withoutDecimals().min(0).optional(),
  })
)

/** A whole split, replacing the live shares of the expense; the shares sum to the amount. */
export const expenseSharesField = vine
  .array(
    vine.object({
      id: refField,
      travellerId: refField,
      shareMinor: minorField(),
    })
  )
  .maxLength(50)

export const expenseChanges = vine.compile(
  vine.object({
    kind: vine.enum(EXPENSE_KINDS).optional(),
    categoryId: refField.nullable().optional(),
    eventId: refField.nullable().optional(),
    amountMinor: minorField().optional(),
    currency: currencyField.optional(),
    fxRate: rateField.nullable().optional(),
    fxRateDate: dateField.nullable().optional(),
    fxSource: vine.enum(FX_SOURCES).nullable().optional(),
    spentOn: dateField.optional(),
    description: shortText.nullable().optional(),
    paidByTravellerId: refField.nullable().optional(),
    needsDetails: vine.boolean().optional(),
    shares: expenseSharesField.optional(),
  })
)

export const expenseShareChanges = vine.compile(
  vine.object({
    expenseId: refField.optional(),
    travellerId: refField.optional(),
    shareMinor: minorField().optional(),
  })
)

const contact = vine.object({
  name: shortText,
  phone: vine.string().trim().minLength(1).maxLength(40),
  note: vine.string().trim().maxLength(500).nullable(),
})

export const emergencyChanges = vine.compile(
  vine.object({
    contacts: vine.array(contact).maxLength(20).nullable().optional(),
    insurance: vine
      .object({
        provider: shortText,
        policyNumber: vine.string().trim().maxLength(100).nullable(),
        phone: vine.string().trim().maxLength(40).nullable(),
      })
      .nullable()
      .optional(),
    embassy: vine
      .object({
        name: shortText,
        phone: vine.string().trim().maxLength(40).nullable(),
        address: longText.nullable(),
      })
      .nullable()
      .optional(),
    medical: vine.object({ notes: longText.nullable() }).nullable().optional(),
    notes: longText.nullable().optional(),
  })
)
