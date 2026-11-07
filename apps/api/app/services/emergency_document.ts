import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { I18n } from '@adonisjs/i18n'
import {
  EMERGENCY_INFO_KEYS,
  type EmergencyInfo,
  type EmergencyInfoContent,
  type ErrorCode,
} from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type Trip from '#models/trip'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { emergencyEntity } from '#services/sync/entities/emergency_entity'
import type { DbRow } from '#services/sync/entity_spec'
import { MutationApplier } from '#services/sync/mutation_applier'
import { rowToWire } from '#services/sync/row_wire'

/**
 * The emergency document of a trip over REST (`GET/PUT /trips/:tripId/emergency`).
 * A PUT replaces the whole document through the same `emergency` mutation
 * as sync push: every key gets the request's clock (a key the body leaves
 * out becomes null, so clearing it wins against older offline edits), and
 * the activity feed sees the change. Never logged.
 */
@inject()
export class EmergencyDocument {
  constructor(
    private readonly applier: MutationApplier,
    private readonly clock: Clock
  ) {}

  /** The live document, or null while the trip has none. */
  async read(trip: Trip): Promise<EmergencyInfo | null> {
    const row = (await db
      .from(emergencyEntity.table)
      .where('trip_id', trip.id)
      .whereNull('deleted_at')
      .first()) as DbRow | null
    return row ? (rowToWire(emergencyEntity, row) as unknown as EmergencyInfo) : null
  }

  /** Replaces the document with `content` (already validated) as `user`'s change, made now. */
  async replace(
    user: User,
    trip: Trip,
    content: EmergencyInfoContent,
    i18n: I18n
  ): Promise<EmergencyInfo> {
    const changes = Object.fromEntries(
      EMERGENCY_INFO_KEYS.map((key) => [key, content[key] ?? null])
    )
    const result = await this.applier.apply(
      user,
      {
        mutationId: randomUUID(),
        tripId: trip.id,
        entity: 'emergency',
        op: 'upsert',
        id: trip.id,
        changes,
        changedAt: this.clock.now().toISOString(),
      },
      i18n
    )
    if (result.status === 'rejected' || !result.row) {
      // The body passed the validator already; what is left is a race on the row (409) or the trip going away.
      throw new ApiException((result.error?.code ?? 'E_CONFLICT') as ErrorCode)
    }
    return result.row as unknown as EmergencyInfo
  }
}
