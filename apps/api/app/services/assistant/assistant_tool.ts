import type { I18n } from '@adonisjs/i18n'
import type { AiAction } from '@monkitrips/shared'
import type Trip from '#models/trip'
import type User from '#models/user'
import type { LlmTool } from '#services/llm/llm_provider'
import { PromptBuilder } from '#services/llm/prompt_builder'
import { ASSISTANT_TOOL_RESULT_MAX_CHARS } from '#config/assistant'

/** What every tool call runs with: one member, one trip, one turn of one conversation. */
export interface ToolContext {
  user: User
  /** The only trip a tool may read or propose changes to. */
  trip: Trip
  conversationId: string
  /** The assistant message of the turn, the proposals belong to it. */
  messageId: string
  i18n: I18n
}

/** What a tool answers: the text the model reads and, for a write tool, the proposal it recorded. */
export interface ToolOutcome {
  content: string
  isError?: boolean
  action?: AiAction
}

/**
 * One tool of the assistant. `definition` is provider-neutral (name,
 * description, JSON Schema of the input); `run` reads the trip or records
 * a proposal, and never writes trip content.
 */
export interface AssistantTool {
  readonly definition: LlmTool
  run(ctx: ToolContext, input: Record<string, unknown>): Promise<ToolOutcome>
}

/**
 * The model asked for something the tool cannot do (bad input, an id that
 * is not in this trip). Answered to the model as a tool error so it can
 * correct itself; the message is written by the app and never echoes
 * trip content.
 */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolInputError'
  }
}

/** What the model reads when a result was cut to fit. */
export const TRUNCATED_HINT =
  'The result was cut to fit. Narrow the request to see the rest: for list_events, a from/to date range of a few days.'

/** The longest array of a result, the one to shorten first. */
function longestList(body: Record<string, unknown>): string | null {
  let key: string | null = null
  let length = 0
  for (const [name, value] of Object.entries(body)) {
    if (Array.isArray(value) && value.length > length) {
      key = name
      length = value.length
    }
  }
  return key
}

/**
 * A tool result for the model: the payload as JSON inside `<data>`, since
 * almost every value in it (titles, notes, addresses, names of stops) was
 * typed by a member and is untrusted content, never instructions. The
 * whole result stays within `ASSISTANT_TOOL_RESULT_MAX_CHARS`: past it, the
 * longest lists are shortened from the end and the result says
 * `truncated: true` with a hint to narrow the request.
 */
export function toolData(tool: string, payload: Record<string, unknown>): ToolOutcome {
  const label = `${tool} result`
  const render = (body: Record<string, unknown>) =>
    PromptBuilder.untrusted(label, JSON.stringify(body))
  let body: Record<string, unknown> = { ...payload }
  let content = render(body)
  if (content.length <= ASSISTANT_TOOL_RESULT_MAX_CHARS) return { content }
  body = { ...body, truncated: true, hint: TRUNCATED_HINT }
  for (;;) {
    content = render(body)
    if (content.length <= ASSISTANT_TOOL_RESULT_MAX_CHARS) return { content }
    const key = longestList(body)
    if (!key) return { content: render({ truncated: true, hint: TRUNCATED_HINT }) }
    const list = body[key] as unknown[]
    // Keep the share of the list that should fit, and always drop at least one row.
    const keep = Math.min(
      list.length - 1,
      Math.floor((list.length * ASSISTANT_TOOL_RESULT_MAX_CHARS) / content.length)
    )
    body = { ...body, [key]: list.slice(0, Math.max(0, keep)) }
  }
}

export function toolError(error: ToolInputError): ToolOutcome {
  return { content: error.message, isError: true }
}
