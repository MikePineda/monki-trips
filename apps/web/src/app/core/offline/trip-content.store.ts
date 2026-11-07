import { Injectable, inject } from '@angular/core'
import type { SyncPushEntity, SyncRowByEntity } from '@monkitrips/shared'
import { CLOCK } from './clock'
import type { MonkiTripsDb } from './db'
import { deriveEventInstants, deriveSegmentInstants, eventFromSegments } from './derive-local-row'
import { ENTITY_TABLES } from './entity-tables'
import type { OutboxMutation } from './mutation'
import { OFFLINE_DB } from './offline-db'
import { OutboxStore } from './outbox.store'
import type { EventRecord, SeatRecord, SegmentRecord, StopRecord, TripRecord } from './records'
import { SyncService } from './sync.service'
import { applyTripChanges } from './trip-record'

/** The entities the itinerary writes through this store. */
export type ContentEntity = Extract<SyncPushEntity, 'trip' | 'stop' | 'event' | 'segment' | 'seat'>

/** A local change to one row: only the fields that changed, in the entity's wire shape. */
export interface ContentWrite<E extends ContentEntity = ContentEntity> {
  tripId: string
  entity: E
  /** The row's id (a client UUIDv7 for a new row). */
  id: string
  changes: Partial<SyncRowByEntity[E]>
}

export interface ContentDelete {
  tripId: string
  entity: ContentEntity
  id: string
}

export interface DeferredDelete {
  /** Puts the rows back and drops the queued delete; a no-op once the window closed. */
  undo(): Promise<void>
}

/**
 * Every write to the itinerary goes through here, online too: the row is
 * updated on the device at once (marked `pending`) and the mutation joins
 * the outbox in the same transaction; the sync loop sends it and the
 * server's answer settles the row. Derived instants are computed locally
 * so a new event is placed before the server confirms it, and a leg
 * recomputes the start and end of its event like the server does.
 */
@Injectable({ providedIn: 'root' })
export class TripContentStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly clock = inject(CLOCK)
  private readonly outbox = inject(OutboxStore)
  private readonly sync = inject(SyncService)

  async upsert<E extends ContentEntity>(write: ContentWrite<E>): Promise<void> {
    const db = await this.database
    const table = db.table(ENTITY_TABLES[write.entity] ?? write.entity)
    const now = this.clock()
    await db.transaction('rw', [table, db.events, db.segments, db.outbox], async () => {
      const previous = (await table.get(write.id)) as Record<string, unknown> | undefined
      const row = this.localRow(write, previous, now)
      await table.put(row)
      if (write.entity === 'segment') {
        await this.recomputeEvent(db, String(row['eventId']), now)
      }
      await this.outbox.enqueueMutation(db, write.tripId, this.mutation(write, 'upsert', now))
    })
    this.sync.requestPush()
  }

  /** Removes the row (and, for an event, its legs and seats) and queues the delete. */
  async remove(input: ContentDelete): Promise<void> {
    const db = await this.database
    await db.transaction('rw', [...this.deleteTables(db), db.outbox], async () => {
      await this.deleteLocally(db, input)
      await this.outbox.enqueueMutation(
        db,
        input.tripId,
        this.mutation({ ...input, changes: {} }, 'delete', this.clock())
      )
    })
    this.sync.requestPush()
  }

  /**
   * Removes the row at once but queues the delete only after `windowMs`,
   * so an "Undo" on the toast can put it back: a tombstone always wins on
   * the server, so a delete that has left the device cannot be undone.
   */
  async removeWithUndo(input: ContentDelete, windowMs: number): Promise<DeferredDelete> {
    const db = await this.database
    const snapshot = await this.snapshotRows(db, input)
    await db.transaction('rw', this.deleteTables(db), () => this.deleteLocally(db, input))
    let queued = false
    const timer = setTimeout(() => {
      queued = true
      void this.remove(input)
    }, windowMs)
    return {
      undo: async () => {
        if (queued) {
          return
        }
        clearTimeout(timer)
        queued = true
        await db.transaction('rw', this.deleteTables(db), async () => {
          for (const { table, rows } of snapshot) {
            await db.table(table).bulkPut(rows)
          }
        })
      },
    }
  }

  private mutation(
    write: ContentWrite | (ContentDelete & { changes: Record<string, unknown> }),
    op: OutboxMutation['op'],
    changedAt: string
  ): OutboxMutation {
    return {
      entity: write.entity,
      op,
      id: write.id,
      changes: write.changes as Record<string, unknown>,
      changedAt,
    }
  }

  private localRow<E extends ContentEntity>(
    write: ContentWrite<E>,
    previous: Record<string, unknown> | undefined,
    now: string
  ): Record<string, unknown> {
    const changes = write.changes as Record<string, unknown>
    if (write.entity === 'trip') {
      const trip = previous as TripRecord | undefined
      if (!trip) {
        throw new Error('A trip is created through POST /trips, never through the outbox')
      }
      return { ...applyTripChanges(trip, changes, now), syncState: 'pending' }
    }
    const base = previous ?? blankRow(write.entity, write.id, write.tripId)
    const merged = { ...base, ...changes, id: write.id, tripId: write.tripId, updatedAt: now }
    if (write.entity === 'event') {
      const event = merged as EventRecord
      return { ...event, ...deriveEventInstants(event), syncState: 'pending' }
    }
    if (write.entity === 'segment') {
      const segment = merged as SegmentRecord
      return { ...segment, ...deriveSegmentInstants(segment), syncState: 'pending' }
    }
    return { ...merged, syncState: 'pending' }
  }

  private async recomputeEvent(db: MonkiTripsDb, eventId: string, now: string): Promise<void> {
    const event = await db.events.get(eventId)
    if (!event) {
      return
    }
    const segments = await db.segments.where('eventId').equals(eventId).toArray()
    await db.events.put({ ...eventFromSegments(event, segments), updatedAt: now })
  }

  private deleteTables(db: MonkiTripsDb) {
    return [db.events, db.segments, db.seats, db.stops]
  }

  private async deleteLocally(db: MonkiTripsDb, input: ContentDelete): Promise<void> {
    const table = db.table(ENTITY_TABLES[input.entity] ?? input.entity)
    if (input.entity === 'event') {
      const segmentIds = await db.segments.where('eventId').equals(input.id).primaryKeys()
      await db.seats.where('segmentId').anyOf(segmentIds).delete()
      await db.segments.bulkDelete(segmentIds)
    }
    const segment = input.entity === 'segment' ? await db.segments.get(input.id) : undefined
    if (input.entity === 'segment') {
      await db.seats.where('segmentId').equals(input.id).delete()
    }
    await table.delete(input.id)
    if (segment) {
      await this.recomputeEvent(db, segment.eventId, this.clock())
    }
  }

  /** The rows a delete would remove, for undo. */
  private async snapshotRows(
    db: MonkiTripsDb,
    input: ContentDelete
  ): Promise<{ table: string; rows: object[] }[]> {
    const table = ENTITY_TABLES[input.entity] ?? input.entity
    const own = await db.table(table).get(input.id)
    const rows: { table: string; rows: object[] }[] = own ? [{ table, rows: [own] }] : []
    if (input.entity === 'event') {
      const segments = await db.segments.where('eventId').equals(input.id).toArray()
      const seats = await db.seats
        .where('segmentId')
        .anyOf(segments.map((segment) => segment.id))
        .toArray()
      rows.push({ table: 'segments', rows: segments }, { table: 'seats', rows: seats })
    }
    return rows
  }
}

/** A new row with every wire field present, before the person's changes. */
function blankRow(entity: ContentEntity, id: string, tripId: string): Record<string, unknown> {
  const base = { id, tripId, updatedAt: '' }
  return blank(entity, base) as unknown as Record<string, unknown>
}

function blank(
  entity: ContentEntity,
  base: { id: string; tripId: string; updatedAt: string }
): object {
  switch (entity) {
    case 'event': {
      const event: EventRecord = {
        ...base,
        kind: 'other',
        status: 'idea',
        title: '',
        stopId: null,
        startsLocal: null,
        startTz: null,
        startsAt: null,
        startsOn: null,
        endsLocal: null,
        endTz: null,
        endsAt: null,
        placeName: null,
        address: null,
        addressLocal: null,
        lat: null,
        lng: null,
        providerName: null,
        bookingCode: null,
        costMinor: null,
        costCurrency: null,
        notes: null,
        leaveBufferMin: null,
        travelMin: null,
        coversNight: null,
      }
      return event
    }
    case 'stop': {
      const stop: StopRecord = {
        ...base,
        position: 0,
        name: '',
        countryCode: null,
        lat: null,
        lng: null,
        tz: null,
        arriveOn: null,
        departOn: null,
      }
      return stop
    }
    case 'segment': {
      const segment: SegmentRecord = {
        ...base,
        eventId: '',
        position: 0,
        carrier: null,
        number: null,
        originCode: null,
        originName: null,
        originLat: null,
        originLng: null,
        destCode: null,
        destName: null,
        destLat: null,
        destLng: null,
        departsLocal: '',
        departsTz: '',
        departsAt: '',
        arrivesLocal: '',
        arrivesTz: '',
        arrivesAt: '',
      }
      return segment
    }
    case 'seat': {
      const seat: SeatRecord = {
        ...base,
        segmentId: '',
        travellerId: '',
        seat: null,
        coach: null,
        ticketNumber: null,
        documentId: null,
      }
      return seat
    }
    default:
      return base
  }
}
