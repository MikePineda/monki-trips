import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { I18n } from '@adonisjs/i18n'
import { errors as vineErrors } from '@vinejs/vine'
import type { TripImportResult, TripImportWarning, TripJsonV1 } from '@monkitrips/shared'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { FxRates } from '#services/fx/fx_rates'
import { MutationApplier } from '#services/sync/mutation_applier'
import { dataRejection } from '#services/sync/data_rejection'
import { MutationRejected, problemMessage } from '#services/sync/mutation_rejected'
import { TripCreation } from '#services/trip_creation'
import { validateTripJson } from '#services/trip_json_schema'
import { planTripImport, type PlannedMutation, type TripImportPlan } from '#domain/trip_import_plan'
import { withTripJsonDefaults } from '#domain/trip_json_defaults'
import { uuidV5 } from '#domain/uuid_v5'
import { tripChanges } from '#validators/sync/entities'

type ValidationMessage = { field: string; rule: string; message: string }

/** Thrown inside the transaction of a dry run to roll it back and keep the summary. */
class DryRunRollback extends Error {
  constructor(readonly result: TripImportResult) {
    super('dry run')
  }
}

/**
 * `POST /trips/import` and `node ace trip:import`: a trip JSON v1 document
 * becomes a new trip owned by the caller. The file passes the JSON Schema,
 * the trip fields pass the trip validator, every `ref` must resolve, and
 * then the whole plan runs through the sync engine in one transaction
 * (validation, derived values, side effects and activity rows are the
 * client write path's). Any failure answers 422 with the failing fields and
 * nothing is written; a dry run rolls the transaction back on purpose.
 */
@inject()
export class TripImporter {
  constructor(
    private readonly clock: Clock,
    private readonly creation: TripCreation,
    private readonly applier: MutationApplier,
    private readonly fxRates: FxRates
  ) {}

  async import(
    user: User,
    input: unknown,
    options: { dryRun: boolean },
    i18n: I18n
  ): Promise<TripImportResult> {
    const problems = validateTripJson(input, i18n)
    if (problems.length > 0) throw new vineErrors.E_VALIDATION_ERROR(problems)
    const document = withTripJsonDefaults(input as TripJsonV1, { homeTz: user.timezone })
    await this.validateTrip(document, i18n)
    if (!options.dryRun) await this.warmRateCache(document)

    const importId = randomUUID()
    const now = this.clock.now()
    try {
      return await db.transaction(async (trx) => {
        const result = await this.rebuild(trx, user, document, importId, now, i18n)
        if (options.dryRun) throw new DryRunRollback({ ...result, tripId: null, dryRun: true })
        return result
      })
    } catch (error) {
      if (error instanceof DryRunRollback) return error.result
      throw error
    }
  }

  /** The trip row's own fields, through the sync validator of the `trip` entity. */
  private async validateTrip(document: TripJsonV1, i18n: I18n): Promise<void> {
    const { name, baseCurrency, budgetMode, budgetTotalMinor, startsOn, endsOn, homeTz } =
      document.trip
    try {
      await tripChanges.validate(
        { name, baseCurrency, budgetMode, budgetTotalMinor, startsOn, endsOn, homeTz },
        { meta: undefined, messagesProvider: i18n.createMessagesProvider() }
      )
    } catch (error) {
      if (!(error instanceof vineErrors.E_VALIDATION_ERROR)) throw error
      throw new vineErrors.E_VALIDATION_ERROR(
        (error.messages as ValidationMessage[]).map((message) => ({
          ...message,
          field: `trip.${message.field}`,
        }))
      )
    }
    if (endsOn < startsOn) {
      throw new vineErrors.E_VALIDATION_ERROR([
        {
          field: 'trip.endsOn',
          rule: 'afterOrEqual',
          message: i18n.t('validator.shared.messages.endsOn.afterOrEqual'),
        },
      ])
    }
  }

  /**
   * What the expense entity's `prepare` hook does for a push: ask the
   * provider for the rates expenses without one will need, before any lock
   * is held. Best effort: an unknown rate leaves the expense pending.
   */
  private async warmRateCache(document: TripJsonV1): Promise<void> {
    const base = document.trip.baseCurrency
    const wanted = new Set<string>()
    for (const expense of document.expenses) {
      if (expense.fxRate || expense.currency === base) continue
      wanted.add(`${expense.currency}:${expense.spentOn}`)
    }
    for (const pair of wanted) {
      const [quote, day] = pair.split(':')
      try {
        await this.fxRates.find(base, quote, day)
      } catch {
        // The transaction reads the cache only; a missing rate stays pending.
      }
    }
  }

  private async rebuild(
    trx: TransactionClientContract,
    user: User,
    document: TripJsonV1,
    importId: string,
    now: Date,
    i18n: I18n
  ): Promise<TripImportResult> {
    const { trip } = await this.creation.createOrFind(
      user,
      { id: uuidV5(importId, 'trip'), ...document.trip },
      trx
    )
    const [traveller] = (await trx
      .from('travellers')
      .where('trip_id', trip.id)
      .where('user_id', user.id)
      .select('id')) as { id: string }[]
    const defaultCategories = (await trx
      .from('budget_categories')
      .where('trip_id', trip.id)
      .select('id', 'key')) as { id: string; key: string | null }[]

    const planned = planTripImport({
      document,
      importId,
      tripId: trip.id,
      callerTravellerId: traveller.id,
      defaultCategories,
      changedAt: now.toISOString(),
    })
    if (!planned.ok) {
      throw new vineErrors.E_VALIDATION_ERROR(
        planned.problems.map((problem) => problemMessage(i18n, problem))
      )
    }

    for (const step of planned.plan.mutations) {
      await this.applyStep(trx, user, step, i18n)
    }
    await this.replayPrintTasks(trx, user, planned.plan, importId, now, i18n)

    return {
      tripId: trip.id,
      dryRun: false,
      summary: {
        trip: { name: trip.name, startsOn: document.trip.startsOn, endsOn: document.trip.endsOn },
        counts: planned.plan.counts,
        warnings: planned.plan.warnings.map((warning): TripImportWarning => ({
          ...warning,
          message: i18n.t(`import.warnings.${warning.code}`, { count: warning.count }),
        })),
      },
    }
  }

  /** One mutation through the engine; a rejection becomes a 422 entry named after the file path. */
  private async applyStep(
    trx: TransactionClientContract,
    user: User,
    step: PlannedMutation,
    i18n: I18n
  ): Promise<void> {
    try {
      const result = await this.applier.applyWithin(trx, user, step.mutation, i18n)
      if (result.status === 'rejected') {
        throw new MutationRejected(result.error!)
      }
    } catch (error) {
      const rejection = error instanceof MutationRejected ? error : dataRejection(error, i18n)
      if (!rejection) throw error
      const errors = rejection.error.errors as ValidationMessage[] | undefined
      throw new vineErrors.E_VALIDATION_ERROR(
        errors && errors.length > 0
          ? errors.map((entry) => ({ ...entry, field: `${step.path}.${entry.field}` }))
          : [{ field: step.path, rule: rejection.error.code, message: rejection.error.message }]
      )
    }
  }

  /** The print tasks the `print` tags just created get the done state the file recorded. */
  private async replayPrintTasks(
    trx: TransactionClientContract,
    user: User,
    plan: TripImportPlan,
    importId: string,
    now: Date,
    i18n: I18n
  ): Promise<void> {
    for (const { documentId, doneAt } of plan.printTasksDone) {
      const task = (await trx
        .from('tasks')
        .where('source_document_id', documentId)
        .where('origin', 'document')
        .whereNull('deleted_at')
        .select('id', 'trip_id')
        .first()) as { id: string; trip_id: string } | null
      if (!task) continue
      await this.applyStep(
        trx,
        user,
        {
          path: `documents[${documentId}].printTask`,
          mutation: {
            mutationId: uuidV5(importId, `mutation:print-task:${documentId}`),
            tripId: task.trip_id,
            entity: 'task',
            op: 'upsert',
            id: task.id,
            changes: { doneAt },
            changedAt: now.toISOString(),
          },
        },
        i18n
      )
    }
  }
}
