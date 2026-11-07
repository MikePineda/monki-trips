import { Injectable, inject } from '@angular/core'
import type { SyncOp, Traveller } from '@monkitrips/shared'
import { v7 as uuidv7 } from 'uuid'
import { CLOCK } from './clock'
import { OFFLINE_DB } from './offline-db'
import { OutboxStore } from './outbox.store'
import type { TravellerRecord } from './records'
import { toTravellerRecord } from './traveller-record'

/** Outbox kinds of a traveller change. */
export const TRAVELLER_UPSERT = 'traveller.upsert'
export const TRAVELLER_DELETE = 'traveller.delete'

/** Fields of a traveller a device may change. */
export type TravellerChanges = Partial<Pick<Traveller, 'displayName' | 'userId' | 'position'>>

/**
 * The payload of a traveller outbox entry: a `/sync/push` mutation minus
 * `mutationId` and `tripId`, which the entry itself carries.
 */
export interface TravellerMutationPayload {
  entity: 'traveller'
  op: SyncOp
  id: string
  changes: TravellerChanges
  /** ISO instant the person made the change. */
  changedAt: string
}

/**
 * Travellers on the device: the server's rows refilled from a snapshot or
 * a pull, plus local additions, renames and removals written through the
 * outbox (`syncState: 'pending'` until the server answers). A traveller
 * without an account (`userId` null) is a person the app does not know:
 * a child, a friend without the app.
 */
@Injectable({ providedIn: 'root' })
export class TravellersStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly outbox = inject(OutboxStore)
  private readonly clock = inject(CLOCK)

  /**
   * The server's live travellers of a trip replace the device's, except
   * rows whose change still sits in the outbox: a pending rename keeps its
   * local name, a pending removal stays removed, a pending addition stays.
   */
  async refill(tripId: string, travellers: Traveller[]): Promise<void> {
    const db = await this.database
    await db.transaction('rw', db.travellers, db.outbox, async () => {
      const unsent = new Set(
        (await db.outbox.filter((entry) => entry.tripId === tripId).toArray())
          .filter((entry) => entry.kind === TRAVELLER_UPSERT || entry.kind === TRAVELLER_DELETE)
          .map((entry) => (entry.payload as TravellerMutationPayload).id)
      )
      const serverIds = new Set(travellers.map((traveller) => traveller.id))
      const stale = (await db.travellers.where('tripId').equals(tripId).primaryKeys()).filter(
        (id) => !serverIds.has(id) && !unsent.has(id)
      )
      await db.travellers.bulkDelete(stale)
      await db.travellers.bulkPut(
        travellers.filter((traveller) => !unsent.has(traveller.id)).map(toTravellerRecord)
      )
    })
  }

  /** Adds a person without an account at the end of the list. */
  async add(tripId: string, displayName: string): Promise<TravellerRecord> {
    const db = await this.database
    const siblings = await db.travellers.where('tripId').equals(tripId).toArray()
    const position = siblings.reduce((max, row) => Math.max(max, row.position), -1) + 1
    const changedAt = this.clock()
    const record: TravellerRecord = {
      id: uuidv7(),
      tripId,
      displayName,
      userId: null,
      position,
      updatedAt: changedAt,
      syncState: 'pending',
    }
    await db.travellers.put(record)
    await this.queue(
      tripId,
      'upsert',
      record.id,
      { displayName, userId: null, position },
      changedAt
    )
    return record
  }

  async rename(id: string, displayName: string): Promise<void> {
    const db = await this.database
    const record = await db.travellers.get(id)
    if (!record) {
      throw new Error(`Traveller not found on this device: ${id}`)
    }
    const changedAt = this.clock()
    await db.travellers.put({ ...record, displayName, updatedAt: changedAt, syncState: 'pending' })
    await this.queue(record.tripId, 'upsert', id, { displayName }, changedAt)
  }

  async remove(id: string): Promise<void> {
    const db = await this.database
    const record = await db.travellers.get(id)
    if (!record) {
      return
    }
    await db.travellers.delete(id)
    await this.queue(record.tripId, 'delete', id, {}, this.clock())
  }

  private async queue(
    tripId: string,
    op: SyncOp,
    id: string,
    changes: TravellerChanges,
    changedAt: string
  ): Promise<void> {
    const payload: TravellerMutationPayload = { entity: 'traveller', op, id, changes, changedAt }
    await this.outbox.enqueue({
      tripId,
      kind: op === 'delete' ? TRAVELLER_DELETE : TRAVELLER_UPSERT,
      payload,
    })
  }
}
