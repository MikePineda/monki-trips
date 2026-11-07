import type { LlmPurpose } from '@monkitrips/shared'

/**
 * The one interface every model call in the app goes through. The container
 * binds the implementation chosen by `LLM_PROVIDER` (`providers/llm_provider.ts`):
 * `anthropic` speaks the Anthropic Messages API to any compatible endpoint
 * (Anthropic itself, MiniMax), `openai` is a reserved seam, `fake` answers
 * from fixtures. Features never call a provider directly: they go through
 * `LlmClient`, which meters usage and enforces the monthly cap.
 *
 * The shapes below are provider-neutral on purpose: no SDK type leaks into
 * the rest of the app, so swapping the adapter changes nothing above it.
 */

export type LlmRole = 'user' | 'assistant'

export interface LlmTextBlock {
  type: 'text'
  text: string
}

/** An image the model should look at; routed to `LLM_VISION_MODEL` when set. */
export interface LlmImageBlock {
  type: 'image'
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  /** Base64 without newlines. */
  data: string
}

/** A tool call the model made earlier in the conversation. */
export interface LlmToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/** What a tool answered, sent back to the model. */
export interface LlmToolResultBlock {
  type: 'tool_result'
  toolUseId: string
  content: string
  isError?: boolean
}

export type LlmContentBlock = LlmTextBlock | LlmImageBlock | LlmToolUseBlock | LlmToolResultBlock

export interface LlmMessage {
  role: LlmRole
  content: string | LlmContentBlock[]
}

export interface LlmTool {
  name: string
  description: string
  /** JSON Schema of the tool's input. */
  inputSchema: Record<string, unknown>
}

export interface LlmRequest {
  /** What the call is for; logged with its usage and the key of the fake's fixtures. */
  purpose: LlmPurpose
  system: string
  messages: LlmMessage[]
  tools?: LlmTool[]
  /** `auto` (default) lets the model decide; `none` forbids tools. */
  toolChoice?: 'auto' | 'none'
  maxTokens: number
  temperature?: number
}

export interface LlmToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
}

export type LlmStopReason = 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence' | 'refusal'

export interface LlmCompletion {
  /** Every text block, joined. */
  content: string
  toolCalls: LlmToolCall[]
  usage: LlmUsage
  /** The model that answered, as the provider names it. */
  model: string
  stopReason: LlmStopReason
}

/** One step of a streamed answer. Text arrives as it is generated; a tool call once its input is complete. */
export type LlmDelta =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: LlmToolCall }
  | { type: 'done'; completion: LlmCompletion }

/** What a streaming caller can observe besides the deltas. */
export interface LlmStreamOptions {
  /**
   * Called whenever the provider learns the running usage (at the start of
   * the answer and as it grows), so a stream that stops early or fails
   * midway can still be charged what it used.
   */
  onUsage?: (usage: LlmUsage, model: string) => void
}

export abstract class LlmProvider {
  /** The provider's name for `llm_usage.provider`. */
  abstract readonly name: string

  /** The whole answer at once. Throws `LlmUnavailableError` when the provider cannot answer. */
  abstract complete(request: LlmRequest): Promise<LlmCompletion>

  /** The answer as it is generated; the last delta is `done` with the full completion. */
  abstract stream(request: LlmRequest, options?: LlmStreamOptions): AsyncIterable<LlmDelta>
}

/** The provider could not answer: network, upstream 4xx/5xx, timeout, or not configured. Answers 503. */
export class LlmUnavailableError extends Error {
  constructor(
    message = 'llm provider unavailable',
    readonly status?: number
  ) {
    super(message)
    this.name = 'LlmUnavailableError'
  }
}

/** The text of a message, image and tool blocks left out. */
export function messageText(message: LlmMessage): string {
  if (typeof message.content === 'string') return message.content
  return message.content
    .filter((block): block is LlmTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

/** Whether any message carries an image. */
export function hasImageInput(request: Pick<LlmRequest, 'messages'>): boolean {
  return request.messages.some(
    (message) =>
      typeof message.content !== 'string' && message.content.some((block) => block.type === 'image')
  )
}
