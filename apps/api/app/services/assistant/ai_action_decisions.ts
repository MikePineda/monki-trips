import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { I18n } from '@adonisjs/i18n'
import type { AiAction, SyncMutation, SyncMutationResult } from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type Trip from '#models/trip'
import type User from '#models/user'
import { aiActionWire } from '#services/assistant/ai_action_wire'
import { AiConversations } from '#services/assistant/ai_conversations'
import type { BaselineRow } from '#services/assistant/mutation_dry_run'
import { Clock } from '#services/clock'
import { PUSH_ENTITIES } from '#services/sync/entity_registry'
import { MutationApplier } from '#services/sync/mutation_applier'
import { MutationRejected } from '#services/sync/mutation_rejected'

type Row = Record<string, unknown>

export interface AcceptedAction {
  action: AiAction
  /** What each stored mutation did, as `POST /sync/push` would have answered. */
  results: SyncMutationResult[]
}

/** The trip changed under the proposal; carries nothing but the fact. */
class StaleProposal extends Error {}

/**
 * The member's decision on a proposal. Only the account whose conversation
 * holds the action may decide (anyone else gets 404), and only while it is
 * `proposed` and not past its expiry (else 409 `E_AI_ACTION_CLOSED` with
 * the current `status`).
 *
 * Accepting applies the stored mutations, exactly as proposed, through
 * `MutationApplier` in one transaction and in the member's name, recorded
 * in `trip_activity` with `via: assistant`. Every row the proposal touches
 * must still carry the change stamp it had when the proposal was made, and
 * every mutation must apply in full; otherwise nothing is written, the
 * action is marked `failed` and the answer is 409 `E_AI_ACTION_STALE`.
 */
@inject()
export class AiActionDecisions {
  constructor(
    private readonly applier: MutationApplier,
    private readonly conversations: AiConversations,
    private readonly clock: Clock
  ) {}

  async accept(user: User, trip: Trip, id: string, i18n: I18n): Promise<AcceptedAction> {
    await this.conversations.expireDue(trip.id)
    await this.prepare(user, trip, id)
    try {
      return await db.transaction(async (trx) => {
        const row = await this.openAction(trx, user, trip, id)
        const mutations = row['mutations'] as SyncMutation[]
        await this.checkBaseline(trx, trip, row['baseline'] as BaselineRow[])
        const changedAt = this.clock.now().toISOString()
        const results: SyncMutationResult[] = []
        for (const mutation of mutations) {
          const result = await this.applier.applyWithin(
            trx,
            user,
            { ...mutation, tripId: trip.id, changedAt },
            i18n,
            { via: 'assistant' }
          )
          if (result.status !== 'applied') throw new StaleProposal()
          results.push(result)
        }
        const decided = await this.close(trx, id, 'accepted')
        return { action: aiActionWire(decided), results }
      })
    } catch (error) {
      if (error instanceof StaleProposal || error instanceof MutationRejected) {
        await db.from('ai_actions').where('id', id).where('status', 'proposed').update({
          status: 'failed',
          error_code: 'E_AI_ACTION_STALE',
          decided_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        throw new ApiException('E_AI_ACTION_STALE')
      }
      throw error
    }
  }

  async reject(user: User, trip: Trip, id: string): Promise<AiAction> {
    await this.conversations.expireDue(trip.id)
    return db.transaction(async (trx) => {
      await this.openAction(trx, user, trip, id)
      return aiActionWire(await this.close(trx, id, 'rejected'))
    })
  }

  /**
   * Runs the entities' slow lookups (an expense's exchange rate) before the
   * transaction, like a sync push does; only for the caller's own action.
   */
  private async prepare(user: User, trip: Trip, id: string): Promise<void> {
    const row = (await db
      .from('ai_actions')
      .where('id', id)
      .where('trip_id', trip.id)
      .where('user_id', user.id)
      .select('mutations')
      .first()) as { mutations: SyncMutation[] } | null
    for (const mutation of row?.mutations ?? []) {
      const spec = PUSH_ENTITIES[mutation.entity]
      if (!spec.prepare || mutation.op !== 'upsert') continue
      await spec
        .prepare({ tripId: trip.id, id: mutation.id, changes: mutation.changes ?? {} })
        .catch(() => {})
    }
  }

  /** The caller's own action of this trip, locked, still `proposed`; else 404 or 409. */
  private async openAction(
    trx: TransactionClientContract,
    user: User,
    trip: Trip,
    id: string
  ): Promise<Row> {
    const row = (await trx
      .from('ai_actions')
      .where('id', id)
      .where('trip_id', trip.id)
      .where('user_id', user.id)
      .forUpdate()
      .first()) as Row | null
    if (!row) throw new ApiException('E_ROW_NOT_FOUND')
    if (row['status'] !== 'proposed') {
      throw new ApiException('E_AI_ACTION_CLOSED', { status: row['status'] })
    }
    return row
  }

  /** Every touched row still has the stamp it had at proposal time (a new row still does not exist). */
  private async checkBaseline(
    trx: TransactionClientContract,
    trip: Trip,
    baseline: BaselineRow[]
  ): Promise<void> {
    for (const entry of baseline) {
      const spec = PUSH_ENTITIES[entry.entity]
      const row = (await trx
        .from(spec.table)
        .where(spec.idColumn, entry.id)
        .forUpdate()
        .select('change_seq', 'deleted_at', spec.tripColumn)
        .first()) as Row | null
      if (entry.changeSeq === null) {
        if (row) throw new StaleProposal()
        continue
      }
      if (
        !row ||
        row['deleted_at'] !== null ||
        String(row[spec.tripColumn]) !== trip.id ||
        String(row['change_seq']) !== entry.changeSeq
      ) {
        throw new StaleProposal()
      }
    }
  }

  private async close(
    trx: TransactionClientContract,
    id: string,
    status: 'accepted' | 'rejected'
  ): Promise<Row> {
    const now = this.clock.now()
    const [row] = (await trx
      .from('ai_actions')
      .where('id', id)
      .update({ status, decided_at: now, updated_at: now })
      .returning('*')) as Row[]
    return row
  }
}
