import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { I18n } from '@adonisjs/i18n'
import type { SyncMutation, SyncMutationResult } from '@monkitrips/shared'
import type Trip from '#models/trip'
import type User from '#models/user'
import { ToolInputError } from '#services/assistant/assistant_tool'
import { PUSH_ENTITIES } from '#services/sync/entity_registry'
import { MutationApplier } from '#services/sync/mutation_applier'
import { MutationRejected } from '#services/sync/mutation_rejected'
import { TripContent, type TripContentRows } from '#services/trip_content'

/** A row a proposal touches and the change stamp it had when the proposal was made (null: a new row). */
export interface BaselineRow {
  entity: SyncMutation['entity']
  id: string
  changeSeq: string | null
}

export interface DryRunResult {
  results: SyncMutationResult[]
  /** The trip's live content as it would be after the mutations. */
  after: TripContentRows
  baseline: BaselineRow[]
}

/** Carries the dry run's result out of the transaction it rolls back. */
class DryRunRollback extends Error {
  constructor(readonly result: DryRunResult) {
    super('dry run rollback')
  }
}

/**
 * Runs a proposal's mutations through the real `MutationApplier`, in the
 * member's name and `via: assistant`, inside a transaction that is always
 * rolled back. A proposal is therefore validated by exactly the code that
 * will apply it on accept (entity validators, derived instants, references
 * inside the trip, LWW), and the diff is computed from the trip as it
 * would really be. Nothing is written: no row, no activity, no stored
 * mutation. A rejection becomes a `ToolInputError` naming fields and rules.
 */
@inject()
export class MutationDryRun {
  constructor(
    private readonly applier: MutationApplier,
    private readonly content: TripContent
  ) {}

  async run(user: User, trip: Trip, mutations: SyncMutation[], i18n: I18n): Promise<DryRunResult> {
    try {
      await db.transaction(async (trx) => {
        const baseline: BaselineRow[] = []
        for (const mutation of mutations) {
          const spec = PUSH_ENTITIES[mutation.entity]
          const row = (await trx
            .from(spec.table)
            .where(spec.idColumn, mutation.id)
            .select('change_seq', spec.tripColumn)
            .first()) as Record<string, unknown> | null
          if (row && String(row[spec.tripColumn]) !== trip.id) {
            throw new ToolInputError('A change points at a row that is not part of this trip.')
          }
          baseline.push({
            entity: mutation.entity,
            id: mutation.id,
            changeSeq: row ? String(row['change_seq']) : null,
          })
        }
        const results: SyncMutationResult[] = []
        for (const mutation of mutations) {
          results.push(
            await this.applier.applyWithin(trx, user, mutation, i18n, { via: 'assistant' })
          )
        }
        const after = await this.content.load(trip.id, trx)
        throw new DryRunRollback({ results, after, baseline })
      })
    } catch (error) {
      if (error instanceof DryRunRollback) return error.result
      if (error instanceof MutationRejected) throw rejectionForModel(error)
      throw error
    }
    throw new Error('dry run finished without a result')
  }
}

/** What the model reads about a refused change: the code and the failing fields and rules, never values. */
export function rejectionForModel(error: MutationRejected): ToolInputError {
  const problems = (error.error.errors ?? []).map((one) => `${one.field} (${one.rule})`)
  if (problems.length > 0) {
    return new ToolInputError(
      `The change was refused: ${problems.join(', ')}. Fix these fields and call again.`
    )
  }
  if (error.error.code === 'E_ROW_NOT_FOUND') {
    return new ToolInputError('The change was refused: a referenced row is not part of this trip.')
  }
  return new ToolInputError(`The change was refused (${error.error.code}).`)
}
