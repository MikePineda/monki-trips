/**
 * "Ready to fly": the seven checks that say the device can run the trip
 * with no connection. The device gathers the facts (service worker state,
 * Dexie contents, storage estimate, platform); this decides.
 *   version    a cached app version with no update pending
 *   snapshot   trip data refreshed less than 24 hours ago
 *   documents  every document saved for offline has the server's hash
 *   assets     both language catalogs and the mascot are cached
 *   storage    storage is persisted and free space is at least twice the usage
 *   outbox     nothing left to sync
 *   installed  on iOS the app runs installed (Safari and the installed app do not share storage)
 */
import { epochMs, type IsoInstant } from './zoned_instant.ts'

export const SNAPSHOT_MAX_AGE_MS = 24 * 3_600_000

/** Free space must be at least this many times the current usage. */
export const FREE_SPACE_RATIO = 2

export const READINESS_CHECK_KEYS = [
  'version',
  'snapshot',
  'documents',
  'assets',
  'storage',
  'outbox',
  'installed',
] as const

export type ReadinessCheckKey = (typeof READINESS_CHECK_KEYS)[number]

export type Platform = 'ios' | 'android' | 'desktop' | 'other'

export interface OfflineDocumentState {
  id: string
  /** `sha256` the server reports for the current file. */
  serverSha256: string
  /** `sha256` of the blob the device holds, or null when not saved. */
  cachedSha256: string | null
}

export interface OfflineReadinessInput {
  now: IsoInstant
  app: { cachedVersion: string | null; updatePending: boolean }
  snapshotAt: IsoInstant | null
  /** Documents the person asked to keep offline. */
  documents: readonly OfflineDocumentState[]
  assets: { locales: boolean; mascot: boolean }
  storage: { persisted: boolean; usageBytes: number; quotaBytes: number }
  outboxCount: number
  platform: Platform
  installed: boolean
}

export interface ReadinessCheck {
  key: ReadinessCheckKey
  ok: boolean
  /** True when the check does not apply on this platform (it still reads `ok`). */
  notApplicable?: boolean
  /** Ids of the documents that are missing or stale (documents check only). */
  documentIds?: string[]
  /** Age of the snapshot in milliseconds (snapshot check only). */
  ageMs?: number
  /** Pending mutations (outbox check only). */
  count?: number
}

export interface OfflineReadiness {
  ready: boolean
  checks: ReadinessCheck[]
}

export function offlineReadiness(input: OfflineReadinessInput): OfflineReadiness {
  const nowMs = epochMs(input.now)
  const checks: ReadinessCheck[] = []

  checks.push({ key: 'version', ok: input.app.cachedVersion !== null && !input.app.updatePending })

  const ageMs = input.snapshotAt === null ? null : Math.max(0, nowMs - epochMs(input.snapshotAt))
  checks.push({
    key: 'snapshot',
    ok: ageMs !== null && ageMs < SNAPSHOT_MAX_AGE_MS,
    ...(ageMs === null ? {} : { ageMs }),
  })

  const badDocuments = input.documents
    .filter((document) => document.cachedSha256 !== document.serverSha256)
    .map((document) => document.id)
  checks.push({ key: 'documents', ok: badDocuments.length === 0, documentIds: badDocuments })

  checks.push({ key: 'assets', ok: input.assets.locales && input.assets.mascot })

  const free = input.storage.quotaBytes - input.storage.usageBytes
  checks.push({
    key: 'storage',
    ok: input.storage.persisted && free >= FREE_SPACE_RATIO * input.storage.usageBytes,
  })

  checks.push({ key: 'outbox', ok: input.outboxCount === 0, count: input.outboxCount })

  const installRequired = input.platform === 'ios'
  checks.push({
    key: 'installed',
    ok: !installRequired || input.installed,
    ...(installRequired ? {} : { notApplicable: true }),
  })

  return { ready: checks.every((check) => check.ok), checks }
}
