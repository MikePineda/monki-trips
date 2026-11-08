import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { I18n } from '@adonisjs/i18n'
import { errors as vineErrors } from '@vinejs/vine'
import type {
  AiAction,
  AiBookingProposal,
  AiEventChangesProposal,
  BookingDraft,
  ExtractionReviewFlag,
  ExtractionSource,
  SyncMutation,
} from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type Trip from '#models/trip'
import type User from '#models/user'
import { ToolInputError } from '#services/assistant/assistant_tool'
import { aiActionWire } from '#services/assistant/ai_action_wire'
import { AiConversations } from '#services/assistant/ai_conversations'
import { MutationDryRun, type BaselineRow } from '#services/assistant/mutation_dry_run'
import { ProposalRecorder, type ProposalOrigin } from '#services/assistant/proposal_recorder'
import {
  draftProblems,
  normalizeDraft,
  revisedReviewFlags,
  type DraftProblem,
  type LooseDraft,
} from '#services/assistant/extraction/booking_draft_rules'
import { bookingMutations } from '#services/assistant/extraction/booking_mutations'
import { Clock } from '#services/clock'
import { TripViews } from '#services/trip_views'
import { nightShifts } from '#domain/night_shifts'

/** The fields of the added event the review diff shows, in display order. */
const DIFF_FIELDS = [
  'title',
  'kind',
  'status',
  'startsLocal',
  'startTz',
  'endsLocal',
  'endTz',
  'placeName',
  'address',
  'addressLocal',
  'providerName',
  'bookingCode',
  'costMinor',
  'costCurrency',
  'notes',
] as const

interface Built {
  mutations: SyncMutation[]
  baseline: BaselineRow[]
  changes: AiEventChangesProposal
}

export interface NewBookingProposal {
  draft: BookingDraft
  review: ExtractionReviewFlag[]
  source: ExtractionSource
  documentId: string | null
}

/**
 * A booking draft as a proposal (`ai_actions`, tool `extract_booking`):
 * the draft becomes sync mutations (`bookingMutations`), which run through
 * the same rolled-back dry run as the chat's write tools, so the proposal
 * is validated by the code that applies it on accept and its diff (the
 * event as it would be added, the nights whose cover changes) is read from
 * the trip as it would be. Accept and reject are the chat's own
 * (`AiActionDecisions`); `revise` lets the member correct the draft first.
 * Nothing here writes trip content.
 */
@inject()
export class BookingProposals {
  constructor(
    private readonly dryRun: MutationDryRun,
    private readonly recorder: ProposalRecorder,
    private readonly conversations: AiConversations,
    private readonly views: TripViews,
    private readonly clock: Clock
  ) {}

  /** Records the proposal; a draft the trip cannot take throws `ToolInputError`. */
  async propose(origin: ProposalOrigin, i18n: I18n, input: NewBookingProposal): Promise<AiAction> {
    const eventId = randomUUID()
    const built = await this.build(
      origin.user,
      origin.trip,
      i18n,
      input.draft,
      eventId,
      input.documentId
    )
    const proposal: AiBookingProposal = {
      kind: 'booking',
      documentId: input.documentId,
      eventId,
      source: input.source,
      draft: input.draft,
      review: input.review,
      changes: built.changes,
    }
    return this.recorder.record(
      origin,
      'extract_booking',
      proposal,
      built.mutations,
      built.baseline
    )
  }

  /**
   * The member's corrected draft replaces the proposed one: validated
   * again (422 with `draft.<path>` fields), mutations, baseline and diff
   * computed again, and the flags of fields the member changed dropped.
   * Only the account that asked for the proposal may revise it (anyone
   * else: 404), only while it is `proposed` (else 409 `E_AI_ACTION_CLOSED`)
   * and only a booking (409 `E_AI_ACTION_NOT_REVISABLE`).
   */
  async revise(user: User, trip: Trip, i18n: I18n, id: string, raw: LooseDraft): Promise<AiAction> {
    await this.conversations.expireDue(trip.id)
    const row = (await db
      .from('ai_actions')
      .where('id', id)
      .where('trip_id', trip.id)
      .where('user_id', user.id)
      .first()) as Record<string, unknown> | null
    if (!row) throw new ApiException('E_ROW_NOT_FOUND')
    if (row['status'] !== 'proposed') {
      throw new ApiException('E_AI_ACTION_CLOSED', { status: row['status'] })
    }
    if (row['tool'] !== 'extract_booking') throw new ApiException('E_AI_ACTION_NOT_REVISABLE')

    const draft = normalizeDraft(raw)
    const problems = draftProblems(draft)
    if (problems.length > 0) throw validationError(i18n, problems)
    const previous = row['proposal'] as AiBookingProposal
    let built: Built
    try {
      built = await this.build(user, trip, i18n, draft, previous.eventId, previous.documentId)
    } catch (error) {
      if (error instanceof ToolInputError) {
        throw validationError(i18n, [{ field: '', rule: 'schema' }])
      }
      throw error
    }
    const proposal: AiBookingProposal = {
      ...previous,
      draft,
      review: revisedReviewFlags(previous.draft, previous.review, draft),
      changes: built.changes,
    }
    const now = this.clock.now()
    const [updated] = (await db
      .from('ai_actions')
      .where('id', id)
      .where('status', 'proposed')
      .where('expires_at', '>', now)
      .update({
        proposal: JSON.stringify(proposal),
        mutations: JSON.stringify(built.mutations),
        baseline: JSON.stringify(built.baseline),
        updated_at: now,
      })
      .returning('*')) as Record<string, unknown>[]
    if (!updated) throw new ApiException('E_AI_ACTION_CLOSED', { status: 'expired' })
    return aiActionWire(updated)
  }

  private async build(
    user: User,
    trip: Trip,
    i18n: I18n,
    draft: BookingDraft,
    eventId: string,
    documentId: string | null
  ): Promise<Built> {
    const changedAt = this.clock.now().toISOString()
    const labels = { seats: i18n.t('extraction.seats'), coach: i18n.t('extraction.coach') }
    const result = await this.dryRun.run(user, trip, i18n, () =>
      bookingMutations(draft, {
        tripId: trip.id,
        eventId,
        documentId,
        newId: randomUUID,
        changedAt,
        labels,
      })
    )
    const will = result.after.events.find((event) => event.id === eventId)!
    const nightsBefore = this.views.nightsOf(trip, result.before)
    const nightsAfter = this.views.nightsOf(trip, result.after)
    const changes: AiEventChangesProposal = {
      kind: 'event_changes',
      summary: null,
      events: [
        {
          op: 'add',
          eventId,
          kind: will.kind,
          title: will.title,
          status: will.status,
          fields: DIFF_FIELDS.flatMap((field) => {
            const value = will[field] ?? null
            return value === null ? [] : [{ field, before: null, after: value }]
          }),
        },
      ],
      nights: nightShifts(nightsBefore.nights, nightsAfter.nights),
      uncoveredBefore: nightsBefore.uncoveredCount,
      uncoveredAfter: nightsAfter.uncoveredCount,
    }
    return { mutations: result.mutations, baseline: result.baseline, changes }
  }
}

/** 422 with one entry per problem, fields as `draft.<path>`, messages in the request's language. */
function validationError(i18n: I18n, problems: DraftProblem[]) {
  return new vineErrors.E_VALIDATION_ERROR(
    problems.map((problem) => {
      const field = problem.field ? `draft.${problem.field}` : 'draft'
      const leaf = field.split('.').pop()!
      return {
        field,
        rule: problem.rule,
        message: i18n.t(`validator.shared.messages.${problem.rule}`, {
          field: i18n.t(`validator.shared.fields.${leaf}`, {}, leaf),
        }),
      }
    })
  )
}
