import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import {
  EVENT_KINDS,
  EVENT_STATUSES,
  type AiEventChange,
  type AiEventChangesProposal,
  type SyncMutation,
  type TripEventRow,
} from '@monkitrips/shared'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { ToolInputError, toolData } from '#services/assistant/assistant_tool'
import { MutationDryRun } from '#services/assistant/mutation_dry_run'
import { ProposalRecorder } from '#services/assistant/proposal_recorder'
import { validateToolInput } from '#services/assistant/tool_input'
import { Clock } from '#services/clock'
import type { TripContentRows } from '#services/trip_content'
import { TripViews } from '#services/trip_views'
import { shiftedEnd } from '#domain/event_move'
import { nightShifts } from '#domain/night_shifts'
import { ASSISTANT_MAX_EVENT_CHANGES } from '#config/assistant'

const OPS = ['add', 'move', 'edit', 'cancel'] as const

/** Event fields a change may set, as the sync `event` entity names them. */
const SETTABLE = [
  'kind',
  'title',
  'status',
  'startsLocal',
  'startTz',
  'endsLocal',
  'endTz',
  'placeName',
  'address',
  'notes',
] as const

/** The fields a diff compares, in display order. */
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
  'notes',
] as const

interface ChangeInput {
  op: (typeof OPS)[number]
  eventId?: string
  kind?: string
  title?: string
  status?: string
  startsLocal?: string
  startTz?: string
  endsLocal?: string
  endTz?: string
  placeName?: string
  address?: string
  notes?: string
}

const text = (max: number) => vine.string().trim().minLength(1).maxLength(max)

const input = vine.compile(
  vine.object({
    summary: vine.string().trim().maxLength(200).optional(),
    changes: vine
      .array(
        vine.object({
          op: vine.enum(OPS),
          eventId: vine.string().uuid().optional(),
          kind: vine.enum(EVENT_KINDS).optional(),
          title: text(200).optional(),
          status: vine.enum(EVENT_STATUSES).optional(),
          startsLocal: text(19).optional(),
          startTz: text(64).optional(),
          endsLocal: text(19).optional(),
          endTz: text(64).optional(),
          placeName: text(200).optional(),
          address: text(500).optional(),
          notes: text(2000).optional(),
        })
      )
      .minLength(1)
      .maxLength(ASSISTANT_MAX_EVENT_CHANGES),
  })
)

const LOCAL_TIME_PROPERTY = {
  type: 'string',
  description: 'Local wall-clock time, YYYY-MM-DDTHH:mm, in the zone of the matching *Tz field',
}

/**
 * Proposes itinerary changes: add, move (a new start; the end keeps the
 * duration unless given), edit or cancel events, with local times and IANA
 * zones. The changes run through the sync entity in a rolled-back dry run;
 * the proposal carries the fields that change per event and the nights
 * whose cover changes (shared night rules before and after), and is stored
 * for the member to accept. Nothing is written here.
 */
@inject()
export class ProposeEventChangesTool implements AssistantTool {
  readonly definition = {
    name: 'propose_event_changes',
    description:
      'Propose changes to the itinerary for the member to accept: add, move, edit or cancel events. Nothing changes until the member accepts. move takes a new startsLocal and keeps the duration unless endsLocal is given. Times are local with IANA zones; a new event without startTz takes the zone of the stop that day, else the trip home zone. Returns the diff, including nights whose bed changes.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One line describing the change' },
        changes: {
          type: 'array',
          maxItems: ASSISTANT_MAX_EVENT_CHANGES,
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: [...OPS] },
              eventId: { type: 'string', description: 'Required for move, edit and cancel' },
              kind: { type: 'string', enum: [...EVENT_KINDS] },
              title: { type: 'string' },
              status: { type: 'string', enum: [...EVENT_STATUSES] },
              startsLocal: LOCAL_TIME_PROPERTY,
              startTz: { type: 'string', description: 'IANA zone, e.g. Asia/Bangkok' },
              endsLocal: LOCAL_TIME_PROPERTY,
              endTz: { type: 'string' },
              placeName: { type: 'string' },
              address: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['op'],
            additionalProperties: false,
          },
        },
      },
      required: ['changes'],
      additionalProperties: false,
    },
  }

  constructor(
    private readonly views: TripViews,
    private readonly dryRun: MutationDryRun,
    private readonly recorder: ProposalRecorder,
    private readonly clock: Clock
  ) {}

  async run(ctx: ToolContext, raw: Record<string, unknown>): Promise<ToolOutcome> {
    const { summary, changes } = await validateToolInput<{
      summary?: string
      changes: ChangeInput[]
    }>(input, raw)
    const changedAt = this.clock.now().toISOString()
    const { before, after, baseline, mutations } = await this.dryRun.run(
      ctx.user,
      ctx.trip,
      ctx.i18n,
      (current) => {
        const planned = changes.map((change, index) =>
          this.mutationOf(ctx, current, change, index, changedAt)
        )
        const ids = planned.map((mutation) => mutation.id)
        if (new Set(ids).size !== ids.length) {
          throw new ToolInputError('Each event may appear in one change only; merge them.')
        }
        return planned
      }
    )
    const beforeById = new Map(before.events.map((event) => [event.id, event]))
    const afterById = new Map(after.events.map((event) => [event.id, event]))
    const events: AiEventChange[] = mutations.map((mutation, index) => {
      const change = changes[index]
      const was = beforeById.get(mutation.id) ?? null
      const will = afterById.get(mutation.id)!
      return {
        op: change.op,
        eventId: mutation.id,
        kind: will.kind,
        title: will.title,
        status: will.status,
        fields: DIFF_FIELDS.flatMap((field) => {
          const previous = was ? (was[field] ?? null) : null
          const next = will[field] ?? null
          return previous === next ? [] : [{ field, before: previous, after: next }]
        }),
      }
    })
    const nightsBefore = this.views.nightsOf(ctx.trip, before)
    const nightsAfter = this.views.nightsOf(ctx.trip, after)
    const proposal: AiEventChangesProposal = {
      kind: 'event_changes',
      summary: summary ?? null,
      events,
      nights: nightShifts(nightsBefore.nights, nightsAfter.nights),
      uncoveredBefore: nightsBefore.uncoveredCount,
      uncoveredAfter: nightsAfter.uncoveredCount,
    }
    const action = await this.recorder.record(
      ctx,
      'propose_event_changes',
      proposal,
      mutations,
      baseline
    )
    return { ...toolData(this.definition.name, ProposalRecorder.forModel(action)), action }
  }

  /** The `event` mutation one change stands for. */
  private mutationOf(
    ctx: ToolContext,
    before: TripContentRows,
    change: ChangeInput,
    index: number,
    changedAt: string
  ): SyncMutation {
    const label = `changes[${index}]`
    const fields: Record<string, unknown> = {}
    for (const field of SETTABLE) {
      if (change[field] !== undefined) fields[field] = change[field]
    }
    let id: string
    if (change.op === 'add') {
      if (change.eventId)
        throw new ToolInputError(`${label}: add creates a new event, omit eventId.`)
      if (!change.kind || !change.title) {
        throw new ToolInputError(`${label}: add needs kind and title.`)
      }
      if (change.startsLocal && !change.startTz) {
        fields['startTz'] = this.zoneOn(ctx, before, change.startsLocal.slice(0, 10))
      }
      id = randomUUID()
    } else {
      const event = change.eventId
        ? before.events.find((one) => one.id === change.eventId)
        : undefined
      if (!event) {
        throw new ToolInputError(
          `${label}: eventId must be the id of an event of this trip (see list_events).`
        )
      }
      id = event.id
      if (change.op === 'cancel') {
        fields['status'] = 'cancelled'
      } else if (change.op === 'move') {
        this.moveFields(before, event, change, fields, label)
      }
      if (Object.keys(fields).length === 0) {
        throw new ToolInputError(`${label}: ${change.op} changes nothing; give the new values.`)
      }
    }
    return {
      mutationId: randomUUID(),
      tripId: ctx.trip.id,
      entity: 'event',
      op: 'upsert',
      id,
      changes: fields,
      changedAt,
    }
  }

  private moveFields(
    before: TripContentRows,
    event: TripEventRow,
    change: ChangeInput,
    fields: Record<string, unknown>,
    label: string
  ): void {
    if (!change.startsLocal) throw new ToolInputError(`${label}: move needs the new startsLocal.`)
    if (before.segments.some((segment) => segment.eventId === event.id)) {
      throw new ToolInputError(
        `${label}: this event's times come from its transport legs and cannot be moved here.`
      )
    }
    if (change.endsLocal === undefined) {
      const end = shiftedEnd(event.startsLocal, event.endsLocal, change.startsLocal)
      if (end) fields['endsLocal'] = end
    }
  }

  /** The zone of the stop that covers `date`, else the trip's home zone. */
  private zoneOn(ctx: ToolContext, before: TripContentRows, date: string): string {
    const stop = before.stops.find(
      (one) => one.tz && one.arriveOn && one.arriveOn <= date && (one.departOn ?? date) >= date
    )
    return stop?.tz ?? ctx.trip.homeTz
  }
}
