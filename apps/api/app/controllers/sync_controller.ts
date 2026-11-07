import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type {
  ApiEnvelope,
  SyncMutation,
  SyncMutationResult,
  SyncPullOutput,
  SyncPushOutput,
} from '@monkitrips/shared'
import { MutationApplier } from '#services/sync/mutation_applier'
import { SyncPull } from '#services/sync/sync_pull'
import { syncPullValidator, syncPushValidator } from '#validators/sync/push'

/**
 * Offline-first sync: `GET /sync/pull` reads every trip the person belongs
 * to incrementally, `POST /sync/push` is the one write path for trip
 * content. Both are per account, not per trip: tenancy is decided per row
 * and per mutation, and a trip the person does not belong to simply does
 * not appear (never 403).
 */
@inject()
export default class SyncController {
  constructor(
    private readonly applier: MutationApplier,
    private readonly puller: SyncPull
  ) {}

  async pull(ctx: HttpContext): Promise<ApiEnvelope<SyncPullOutput>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const query = await syncPullValidator.validate(ctx.request.qs(), {
      meta: undefined,
      messagesProvider: ctx.i18n.createMessagesProvider(),
    })
    return { data: await this.puller.pull(user, query) }
  }

  /** Applies the mutations in order, one transaction each; the batch never fails as a whole. */
  async push(ctx: HttpContext): Promise<ApiEnvelope<SyncPushOutput>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const body = await ctx.request.validateUsing(syncPushValidator)
    const results: SyncMutationResult[] = []
    for (const mutation of body.mutations as SyncMutation[]) {
      results.push(await this.applier.apply(user, mutation, ctx.i18n))
    }
    return { data: { results } }
  }
}
