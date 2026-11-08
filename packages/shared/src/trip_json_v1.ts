import type { BudgetMode } from './budget_mode.ts'
import type { DocumentKind } from './document.ts'
import type { DocumentTag } from './domain/trip_document.ts'
import type { EventKind, EventStatus } from './domain/trip_event.ts'
import type { TaskOrigin, TaskPriority } from './domain/trip_task.ts'
import type { EmergencyInfoContent } from './emergency_info.ts'
import type { ExpenseKind, FxSource } from './expense.ts'
import type { TripMemberRole } from './trip_member_role.ts'
import type { UserProfile } from './user.ts'

/** The `version` string every trip JSON v1 document carries. */
export const TRIP_JSON_VERSION = 'trip-json-v1'

/** Numeric twin of `TRIP_JSON_VERSION`, kept for the account export envelope. */
export const TRIP_JSON_SCHEMA_VERSION = 1

/** Largest document `POST /trips/import` accepts (413 `E_FILE_TOO_LARGE` above it). */
export const TRIP_JSON_MAX_BYTES = 2 * 1024 * 1024

/** How long the `downloadUrl` of an exported file document works. */
export const TRIP_JSON_DOWNLOAD_URL_TTL_SECONDS = 300

/**
 * Portable trip document ("trip JSON v1"): what `GET /trips/:tripId/export`
 * writes and `POST /trips/import` reads. Rows point at each other through
 * `ref`s (short strings unique within the file per entity), never through
 * database ids, so a file can be edited by hand and imported anywhere; an
 * import always creates a new trip owned by the caller. Account ids never
 * leave: members keep role and display name only. Local times travel next
 * to their IANA zone, never as UTC alone; money is integer minor units with
 * its currency; rates are decimal strings. Unknown keys are ignored on
 * import so older files keep working.
 */
export interface TripJsonV1 {
  version: typeof TRIP_JSON_VERSION
  schemaVersion: typeof TRIP_JSON_SCHEMA_VERSION
  exportedAt: string
  trip: TripJsonTrip
  /** Who was on the trip, for the record; an import grants no memberships. */
  members: TripJsonMember[]
  /** The first traveller is the exporting owner; an import maps it to the caller. */
  travellers: TripJsonTraveller[]
  stops: TripJsonStop[]
  events: TripJsonEvent[]
  budgetCategories: TripJsonBudgetCategory[]
  expenses: TripJsonExpense[]
  tasks: TripJsonTask[]
  documents: TripJsonDocument[]
  emergency: EmergencyInfoContent | null
  phraseCards: TripJsonPhraseCards[]
  /** Free text about the file itself (who made it, what was edited); never imported. */
  notes: string | null
}

export interface TripJsonTrip {
  name: string
  baseCurrency: string
  budgetMode: BudgetMode
  budgetTotalMinor: number | null
  startsOn: string
  endsOn: string
  homeTz: string
}

export interface TripJsonMember {
  role: TripMemberRole
  displayName: string
}

export interface TripJsonTraveller {
  ref: string
  displayName: string
  position: number
}

export interface TripJsonStop {
  ref: string
  position: number
  name: string
  countryCode: string | null
  lat: number | null
  lng: number | null
  tz: string | null
  arriveOn: string | null
  departOn: string | null
}

export interface TripJsonSeat {
  travellerRef: string
  seat: string | null
  coach: string | null
  ticketNumber: string | null
  documentRef: string | null
}

export interface TripJsonSegment {
  ref: string
  position: number
  carrier: string | null
  number: string | null
  originName: string | null
  originCode: string | null
  originLat: number | null
  originLng: number | null
  destName: string | null
  destCode: string | null
  destLat: number | null
  destLng: number | null
  departsLocal: string
  departsTz: string
  arrivesLocal: string
  arrivesTz: string
  seats: TripJsonSeat[]
}

export interface TripJsonEvent {
  ref: string
  stopRef: string | null
  kind: EventKind
  title: string
  status: EventStatus
  startsLocal: string | null
  startTz: string | null
  endsLocal: string | null
  endTz: string | null
  placeName: string | null
  address: string | null
  addressLocal: string | null
  lat: number | null
  lng: number | null
  providerName: string | null
  bookingCode: string | null
  costMinor: number | null
  costCurrency: string | null
  notes: string | null
  leaveBufferMin: number | null
  travelMin: number | null
  coversNight: boolean | null
  /** Legs of a transport; when present they decide the event's start and end on import. */
  segments: TripJsonSegment[]
}

export interface TripJsonBudgetCategory {
  ref: string
  /** A default category (`accommodation`, `transport`...) matches the new trip's own row on import. */
  key: string | null
  name: string | null
  budgetMinor: number | null
  position: number
}

export interface TripJsonExpenseShare {
  travellerRef: string
  shareMinor: number
}

export interface TripJsonExpense {
  /** `settlement` for a transfer that settles a split; absent (an expense) in files before WP 4.1. */
  kind?: ExpenseKind
  eventRef: string | null
  categoryRef: string | null
  amountMinor: number
  currency: string
  /** Units of `currency` per 1 base unit, decimal string; null while the rate is unknown. */
  fxRate: string | null
  fxRateDate: string | null
  fxSource: FxSource | null
  /** Derived from the stored rate; informational, recomputed on import. */
  baseAmountMinor: number | null
  spentOn: string
  description: string | null
  paidByTravellerRef: string | null
  needsDetails: boolean
  shares: TripJsonExpenseShare[]
}

export interface TripJsonTask {
  eventRef: string | null
  title: string
  titleKey: string | null
  notes: string | null
  dueOn: string | null
  priority: TaskPriority
  doneAt: string | null
  origin: TaskOrigin
  /** For `origin: document`: the document whose `print` tag created the task. */
  sourceDocumentRef: string | null
  templateItemKey: string | null
}

export interface TripJsonDocument {
  ref: string
  eventRef: string | null
  kind: DocumentKind
  title: string
  url: string | null
  tags: DocumentTag[]
  availableOffline: boolean
  /** Where the bytes of a `file` live in the exporting installation's store. */
  storageKey: string | null
  mime: string | null
  sizeBytes: number | null
  sha256: string | null
  /** A signed link to the bytes, valid `TRIP_JSON_DOWNLOAD_URL_TTL_SECONDS` after export. */
  downloadUrl: string | null
}

export interface TripJsonPhraseCards {
  language: string
  cards: unknown[]
  model: string | null
}

/** Body of `GET /api/v1/me/export`: the profile plus one trip document per trip. */
export interface AccountExport {
  schemaVersion: typeof TRIP_JSON_SCHEMA_VERSION
  exportedAt: string
  profile: UserProfile
  trips: TripJsonV1[]
}

/** What an import could not carry over as it was; each warning names how many rows it concerns. */
export const TRIP_IMPORT_WARNING_CODES = [
  'callerIsFirstTraveller',
  'membersNotImported',
  'fileDocumentAsLink',
  'fileDocumentSkipped',
  'taskOriginReset',
  'phraseCardsSkipped',
] as const

export type TripImportWarningCode = (typeof TRIP_IMPORT_WARNING_CODES)[number]

export interface TripImportWarning {
  code: TripImportWarningCode
  /** Translated for the request's locale. */
  message: string
  count: number
}

export interface TripImportCounts {
  stops: number
  events: number
  segments: number
  seats: number
  expenses: number
  tasks: number
  documents: number
}

/** What `POST /trips/import` reports, with or without `dryRun`. */
export interface TripImportSummary {
  trip: { name: string; startsOn: string; endsOn: string }
  counts: TripImportCounts
  warnings: TripImportWarning[]
}

export interface TripImportResult {
  /** The new trip, or null after a dry run. */
  tripId: string | null
  dryRun: boolean
  summary: TripImportSummary
}
