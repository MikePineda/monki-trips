import { Injectable, Injector, computed, inject, type Signal } from '@angular/core'
import type { TaskPriority } from '@monkitrips/shared'
import { v7 as uuidv7 } from 'uuid'
import { CLOCK } from '../../core/offline/clock'
import { liveSignal } from '../../core/offline/live'
import type { OutboxMutation } from '../../core/offline/mutation'
import { OFFLINE_DB } from '../../core/offline/offline-db'
import { OutboxStore } from '../../core/offline/outbox.store'
import type { TaskRecord } from '../../core/offline/records'
import { SyncService } from '../../core/offline/sync.service'
import { missingTemplateTasks } from '../../domain/pre-trip-template'

export interface NewTaskInput {
  tripId: string
  title: string
  dueOn?: string | null
  priority?: TaskPriority
  eventId?: string | null
  notes?: string | null
}

/** What a person may change on a task; the rest is the server's. */
export type TaskChanges = Partial<
  Pick<TaskRecord, 'title' | 'notes' | 'dueOn' | 'priority' | 'eventId'>
>

/**
 * The trip's tasks on this device, straight from Dexie. Every write is
 * optimistic: the row lands in `tasks` as `pending` and its mutation in
 * the outbox in one transaction, then the sync service sends it when the
 * network allows. Template items are ordinary tasks with their
 * `templateItemKey`; adding the template adds only the items still
 * missing, so the request is idempotent offline and online.
 */
@Injectable({ providedIn: 'root' })
export class TasksStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly outbox = inject(OutboxStore)
  private readonly sync = inject(SyncService)
  private readonly clock = inject(CLOCK)
  private readonly injector = inject(Injector)

  /** Every task on the device, all trips. */
  readonly all = liveSignal<TaskRecord[]>((db) => db.tasks.toArray(), [], {
    injector: this.injector,
  })

  /** The tasks of one trip, following the device's copy. */
  forTrip(tripId: Signal<string>): Signal<TaskRecord[]> {
    return computed(() => this.all().filter((task) => task.tripId === tripId()))
  }

  async add(input: NewTaskInput): Promise<TaskRecord> {
    const now = this.clock()
    const record: TaskRecord = {
      id: uuidv7(),
      tripId: input.tripId,
      eventId: input.eventId ?? null,
      title: input.title.trim(),
      titleKey: null,
      notes: input.notes ?? null,
      dueOn: input.dueOn || null,
      priority: input.priority ?? 'normal',
      doneAt: null,
      doneBy: null,
      origin: 'manual',
      sourceDocumentId: null,
      templateItemKey: null,
      updatedAt: now,
      syncState: 'pending',
    }
    await this.write(record, {
      entity: 'task',
      op: 'upsert',
      id: record.id,
      changes: {
        title: record.title,
        notes: record.notes,
        dueOn: record.dueOn,
        priority: record.priority,
        eventId: record.eventId,
      },
      changedAt: now,
    })
    return record
  }

  /** Ticks or reopens a task. */
  async setDone(id: string, done: boolean): Promise<void> {
    const now = this.clock()
    await this.change(id, { doneAt: done ? now : null }, now)
  }

  async update(id: string, changes: TaskChanges): Promise<void> {
    await this.change(id, changes, this.clock())
  }

  /** Removes the task from the device and queues its deletion. */
  async remove(id: string): Promise<void> {
    const now = this.clock()
    const db = await this.database
    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      await db.tasks.delete(id)
      await this.outbox.enqueueMutation(db, await this.tripOf(id, db), {
        entity: 'task',
        op: 'delete',
        id,
        changes: {},
        changedAt: now,
      })
    })
    this.sync.requestPush()
  }

  /**
   * Brings back a task as a new row (the deleted one may already be a
   * tombstone on the server): same trip, title, notes, date, priority and
   * template key, a fresh id.
   */
  async restore(task: TaskRecord): Promise<TaskRecord> {
    const now = this.clock()
    const record: TaskRecord = {
      ...task,
      id: uuidv7(),
      doneAt: null,
      doneBy: null,
      updatedAt: now,
      syncState: 'pending',
    }
    await this.write(record, {
      entity: 'task',
      op: 'upsert',
      id: record.id,
      changes: insertChanges(record),
      changedAt: now,
    })
    return record
  }

  /**
   * Adds the pre-trip checklist items the trip does not have yet, titled
   * in the current language (`titleOf` translates a template key), due
   * relative to `startsOn`. Returns how many were added.
   */
  async addTemplate(
    tripId: string,
    startsOn: string,
    titleOf: (itemKey: string) => string
  ): Promise<number> {
    const now = this.clock()
    const db = await this.database
    let added = 0
    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      const present = (await db.tasks.where('tripId').equals(tripId).toArray()).map(
        (task) => task.templateItemKey
      )
      for (const { item, titleKey, dueOn } of missingTemplateTasks(startsOn, present)) {
        const record: TaskRecord = {
          id: uuidv7(),
          tripId,
          eventId: null,
          title: titleOf(item.key),
          titleKey,
          notes: null,
          dueOn,
          priority: item.priority,
          doneAt: null,
          doneBy: null,
          origin: 'template',
          sourceDocumentId: null,
          templateItemKey: item.key,
          updatedAt: now,
          syncState: 'pending',
        }
        await db.tasks.put(record)
        await this.outbox.enqueueMutation(db, tripId, {
          entity: 'task',
          op: 'upsert',
          id: record.id,
          changes: insertChanges(record),
          changedAt: now,
        })
        added += 1
      }
    })
    if (added > 0) {
      this.sync.requestPush()
    }
    return added
  }

  private async change(id: string, changes: TaskChanges & { doneAt?: string | null }, now: string) {
    const db = await this.database
    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      const task = await db.tasks.get(id)
      if (!task) {
        throw new Error(`Task not found on this device: ${id}`)
      }
      await db.tasks.put({ ...task, ...changes, updatedAt: now, syncState: 'pending' })
      await this.outbox.enqueueMutation(db, task.tripId, {
        entity: 'task',
        op: 'upsert',
        id,
        changes: { ...changes },
        changedAt: now,
      })
    })
    this.sync.requestPush()
  }

  private async write(record: TaskRecord, mutation: OutboxMutation): Promise<void> {
    const db = await this.database
    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      await db.tasks.put(record)
      await this.outbox.enqueueMutation(db, record.tripId, mutation)
    })
    this.sync.requestPush()
  }

  private async tripOf(id: string, db: Awaited<typeof this.database>): Promise<string> {
    const task = await db.tasks.get(id)
    if (!task) {
      throw new Error(`Task not found on this device: ${id}`)
    }
    return task.tripId
  }
}

/**
 * The fields of a new row the API accepts, plus what the plan's template
 * route would set (`origin`, `templateItemKey`, `titleKey`): the API
 * ignores those today (server-owned columns), the device keeps them.
 */
function insertChanges(record: TaskRecord): Record<string, unknown> {
  return {
    title: record.title,
    notes: record.notes,
    dueOn: record.dueOn,
    priority: record.priority,
    eventId: record.eventId,
    ...(record.templateItemKey
      ? {
          origin: record.origin,
          templateItemKey: record.templateItemKey,
          titleKey: record.titleKey,
        }
      : {}),
  }
}
