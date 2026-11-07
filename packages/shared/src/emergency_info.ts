/** Schema version of `emergency_info.content`. */
export const EMERGENCY_INFO_SCHEMA_VERSION = 1

export interface EmergencyContact {
  name: string
  phone: string
  note: string | null
}

/**
 * Emergency information of a trip, one row per trip. Sync merges it per
 * top-level key (each key has its own last-write-wins clock). Everything is
 * optional: a key the trip never filled in is absent.
 */
export interface EmergencyInfoContent {
  contacts?: EmergencyContact[]
  insurance?: { provider: string; policyNumber: string | null; phone: string | null }
  embassy?: { name: string; phone: string | null; address: string | null }
  medical?: { notes: string | null }
  notes?: string | null
}

export type EmergencyInfoKey = keyof EmergencyInfoContent

export const EMERGENCY_INFO_KEYS = [
  'contacts',
  'insurance',
  'embassy',
  'medical',
  'notes',
] as const satisfies readonly EmergencyInfoKey[]

export interface EmergencyInfo {
  tripId: string
  content: EmergencyInfoContent
  schemaVersion: number
  deletedAt: string | null
  updatedAt: string
}

/** Phrase cards for one language, written by the AI package; synced read-only until then. */
export interface PhraseCards {
  id: string
  tripId: string
  language: string
  cards: unknown[]
  model: string | null
  createdBy: string | null
  deletedAt: string | null
  updatedAt: string
}
