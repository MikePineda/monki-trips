import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { I18n } from '@adonisjs/i18n'
import {
  PRE_TRIP_TEMPLATE_KEYS,
  missingTemplateTasks,
  type TemplateTasksResult,
  type TripTaskRow,
} from '@monkitrips/shared'
import type Trip from '#models/trip'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { taskEntity } from '#services/sync/entities/task_entity'
import type { DbRow } from '#services/sync/entity_spec'
import { MutationApplier } from '#services/sync/mutation_applier'
import { rowToWire } from '#services/sync/row_wire'

/**
 * The pre-trip checklist of a trip (`POST /trips/:tripId/tasks/from-template`).
 * Every template item the trip does not have yet becomes a task through
 * the sync engine (one mutation each, so the field clocks and the activity
 * feed are the real ones), keyed by `templateItemKey`: a second request,
 * or a device that pushed its own checklist offline, adds nothing twice.
 * The stored `title` is the request locale's wording; `titleKey` lets
 * every client render it in its own language.
 */
@inject()
export class TemplateTasks {
  constructor(
    private readonly applier: MutationApplier,
    private readonly clock: Clock
  ) {}

  async apply(user: User, trip: Trip, i18n: I18n): Promise<TemplateTasksResult> {
    const changedAt = this.clock.now().toISOString()
    const present = (await db
      .from('tasks')
      .where('trip_id', trip.id)
      .whereNull('deleted_at')
      .whereNotNull('template_item_key')
      .select('template_item_key')) as { template_item_key: string }[]
    let created = 0
    for (const { item, titleKey, dueOn } of missingTemplateTasks(
      trip.startsOn.toISODate()!,
      present.map((row) => row.template_item_key)
    )) {
      const result = await this.applier.apply(
        user,
        {
          mutationId: randomUUID(),
          tripId: trip.id,
          entity: 'task',
          op: 'upsert',
          id: randomUUID(),
          changes: {
            title: i18n.t(`tasks.${titleKey}`, {}, titleKey),
            titleKey,
            origin: 'template',
            templateItemKey: item.key,
            priority: item.priority,
            dueOn,
          },
          changedAt,
        },
        i18n
      )
      if (result.status === 'applied') {
        created += 1
      } else if (result.status !== 'duplicate' && result.error?.code !== 'E_CONFLICT') {
        // `duplicate` and `E_CONFLICT` mean another request won the race for this item.
        throw new Error(`template item ${item.key} was ${result.status}: ${result.error?.code}`)
      }
    }
    return { tasks: await this.checklist(trip.id), created }
  }

  /** The trip's live checklist, in template order (then by creation for keys the template no longer has). */
  private async checklist(tripId: string): Promise<TripTaskRow[]> {
    const rows = (await db
      .from('tasks')
      .where('trip_id', tripId)
      .whereNull('deleted_at')
      .whereNotNull('template_item_key')
      .orderBy('created_at', 'asc')) as DbRow[]
    const order = (row: DbRow) => {
      const index = PRE_TRIP_TEMPLATE_KEYS.indexOf(String(row.template_item_key))
      return index === -1 ? PRE_TRIP_TEMPLATE_KEYS.length : index
    }
    return rows
      .sort((a, b) => order(a) - order(b))
      .map((row) => rowToWire(taskEntity, row) as unknown as TripTaskRow)
  }
}
