/**
 * The trip assistant on the wire (WP 3.1): conversations private to their
 * creator, their messages, the actions the assistant proposes and the
 * server-sent events of `POST /trips/:tripId/ai/conversations/:id/messages`.
 * Nothing the assistant proposes is written until the member accepts it.
 */
import type { ErrorCode } from './error_codes.ts'
import type { EventKind, EventStatus } from './domain/trip_event.ts'
import type { FxSource } from './expense.ts'
import type { TaskPriority } from './domain/trip_task.ts'

/** `proposed → accepted | rejected | expired | failed`; mirrors the CHECK on `ai_actions.status`. */
export const AI_ACTION_STATUSES = ['proposed', 'accepted', 'rejected', 'expired', 'failed'] as const

export type AiActionStatus = (typeof AI_ACTION_STATUSES)[number]

/** The write tools; mirrors the CHECK on `ai_actions.tool`. */
export const AI_ACTION_TOOLS = ['propose_event_changes', 'add_expense', 'create_task'] as const

export type AiActionTool = (typeof AI_ACTION_TOOLS)[number]

/** Who wrote a message; mirrors the CHECK on `ai_messages.role`. */
export const AI_MESSAGE_ROLES = ['user', 'assistant'] as const

export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number]

/** Tool calls one member message may trigger before the assistant must answer. */
export const ASSISTANT_MAX_TOOL_CALLS_PER_TURN = 6

/** A proposal nobody decided on expires after this long. */
export const AI_ACTION_TTL_HOURS = 24

/** Longest member message the chat accepts, in characters. */
export const ASSISTANT_MESSAGE_MAX_LENGTH = 4000

/** A conversation without a title takes the first characters of its first message. */
export const AI_CONVERSATION_TITLE_LENGTH = 60

/** One field of an event before and after a proposed change. */
export interface AiFieldChange {
  field: string
  before: unknown
  after: unknown
}

/** One event the proposal adds, moves, edits or cancels. */
export interface AiEventChange {
  op: 'add' | 'move' | 'edit' | 'cancel'
  eventId: string
  kind: EventKind
  title: string
  status: EventStatus
  /** Only the fields that change. */
  fields: AiFieldChange[]
}

/** A night whose cover changes with the proposal (`after: null` is a night left without a bed). */
export interface AiNightShift {
  date: string
  before: { eventId: string; title: string } | null
  after: { eventId: string; title: string } | null
}

export interface AiEventChangesProposal {
  kind: 'event_changes'
  /** The model's one-line description of the change, if it gave one. */
  summary: string | null
  events: AiEventChange[]
  /** Nights whose cover changes, from the shared night rules before and after. */
  nights: AiNightShift[]
  uncoveredBefore: number
  uncoveredAfter: number
}

export interface AiExpenseProposal {
  kind: 'expense'
  expenseId: string
  amountMinor: number
  currency: string
  categoryId: string | null
  /** The default category key (`food`), or null for a custom category. */
  categoryKey: string | null
  categoryName: string | null
  spentOn: string
  description: string | null
  baseCurrency: string
  /** The amount in the trip's base currency, or null while the rate is unknown. */
  baseAmountMinor: number | null
  fxRate: string | null
  fxRateDate: string | null
  fxSource: FxSource | null
}

export interface AiTaskProposal {
  kind: 'task'
  taskId: string
  title: string
  dueOn: string | null
  priority: TaskPriority
  notes: string | null
  eventId: string | null
}

/** What the member sees before deciding: a diff, never the raw mutations. */
export type AiProposal = AiEventChangesProposal | AiExpenseProposal | AiTaskProposal

export interface AiAction {
  id: string
  tripId: string
  conversationId: string
  /** The assistant message the proposal belongs to. */
  messageId: string | null
  tool: AiActionTool
  status: AiActionStatus
  proposal: AiProposal
  expiresAt: string
  decidedAt: string | null
  /** Why an action `failed` (`E_AI_ACTION_STALE`). */
  errorCode: ErrorCode | null
  createdAt: string
}

export interface AiMessage {
  id: string
  conversationId: string
  role: AiMessageRole
  content: string
  createdAt: string
}

export interface AiConversation {
  id: string
  tripId: string
  title: string | null
  createdAt: string
  updatedAt: string
}

/** `GET /trips/:tripId/ai/conversations/:id`. */
export interface AiConversationDetail extends AiConversation {
  messages: AiMessage[]
  actions: AiAction[]
}

/**
 * One server-sent event of the chat stream. On the wire each is
 * `event: <type>` and `data: <this object as JSON>`. A turn ends with
 * exactly one `done` or one `error`.
 */
export type AssistantStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'proposal'; action: AiAction }
  | { type: 'done'; conversationId: string; messageId: string; title: string | null }
  | { type: 'error'; code: ErrorCode; message: string }

export type AssistantStreamEventType = AssistantStreamEvent['type']
