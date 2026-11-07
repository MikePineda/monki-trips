import { Injectable, Injector, computed, inject, type Signal } from '@angular/core'
import {
  EMERGENCY_INFO_SCHEMA_VERSION,
  type EmergencyInfoContent,
  type EmergencyInfoKey,
} from '@monkitrips/shared'
import { CLOCK } from '../../core/offline/clock'
import { liveSignal } from '../../core/offline/live'
import { OFFLINE_DB } from '../../core/offline/offline-db'
import { OutboxStore } from '../../core/offline/outbox.store'
import type { EmergencyRecord } from '../../core/offline/records'
import { SyncService } from '../../core/offline/sync.service'
import { changedKeys } from './emergency-form'

/**
 * The emergency information of the trips on this device. `save` writes
 * the merged content locally as `pending` and queues one `emergency`
 * mutation carrying only the top-level keys that changed: the server
 * merges per key with last-write-wins, so two people editing different
 * sections never overwrite each other.
 */
@Injectable({ providedIn: 'root' })
export class EmergencyStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly outbox = inject(OutboxStore)
  private readonly sync = inject(SyncService)
  private readonly clock = inject(CLOCK)
  private readonly injector = inject(Injector)

  readonly all = liveSignal<EmergencyRecord[]>((db) => db.emergency.toArray(), [], {
    injector: this.injector,
  })

  forTrip(tripId: Signal<string>): Signal<EmergencyRecord | undefined> {
    return computed(() => this.all().find((record) => record.tripId === tripId()))
  }

  /** Saves what changed; answers the keys that travelled (none = nothing to save). */
  async save(tripId: string, next: EmergencyInfoContent): Promise<EmergencyInfoKey[]> {
    const now = this.clock()
    const db = await this.database
    let keys: EmergencyInfoKey[] = []
    await db.transaction('rw', [db.emergency, db.outbox], async () => {
      const current = await db.emergency.get(tripId)
      const stored = current?.content ?? {}
      keys = changedKeys(stored, next)
      if (keys.length === 0) {
        return
      }
      // A cleared section travels as null (the API's shape); the device drops the key.
      const changes: Record<string, unknown> = {}
      const content: EmergencyInfoContent = { ...stored }
      for (const key of keys) {
        changes[key] = next[key] ?? null
        if (next[key] === undefined || next[key] === null) {
          delete content[key]
        } else {
          Object.assign(content, { [key]: next[key] })
        }
      }
      await db.emergency.put({
        id: tripId,
        tripId,
        content,
        schemaVersion: current?.schemaVersion ?? EMERGENCY_INFO_SCHEMA_VERSION,
        updatedAt: now,
        syncState: 'pending',
      })
      await this.outbox.enqueueMutation(db, tripId, {
        entity: 'emergency',
        op: 'upsert',
        id: tripId,
        changes,
        changedAt: now,
      })
    })
    if (keys.length > 0) {
      this.sync.requestPush()
    }
    return keys
  }
}
