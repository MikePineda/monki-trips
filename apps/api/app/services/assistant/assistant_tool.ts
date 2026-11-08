import type { I18n } from '@adonisjs/i18n'
import type { AiAction } from '@monkitrips/shared'
import type Trip from '#models/trip'
import type User from '#models/user'
import type { LlmTool } from '#services/llm/llm_provider'
import { PromptBuilder } from '#services/llm/prompt_builder'

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

/**
 * A tool result for the model: the payload as JSON inside `<data>`, since
 * almost every value in it (titles, notes, addresses, names of stops) was
 * typed by a member and is untrusted content, never instructions.
 */
export function toolData(tool: string, payload: unknown): ToolOutcome {
  return { content: PromptBuilder.untrusted(`${tool} result`, JSON.stringify(payload)) }
}

export function toolError(error: ToolInputError): ToolOutcome {
  return { content: error.message, isError: true }
}
