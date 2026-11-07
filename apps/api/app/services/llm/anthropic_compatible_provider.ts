import {
  LLM_ANTHROPIC_VERSION,
  LLM_DEFAULT_BASE_URL,
  LLM_REQUEST_TIMEOUT_MS,
  LLM_RETRY_DELAYS_MS,
} from '#config/llm'
import {
  hasImageInput,
  LlmProvider,
  LlmUnavailableError,
  type LlmCompletion,
  type LlmContentBlock,
  type LlmDelta,
  type LlmMessage,
  type LlmRequest,
  type LlmStopReason,
  type LlmStreamOptions,
  type LlmToolCall,
} from '#services/llm/llm_provider'
import { parseSseStream } from '#services/llm/sse'

export interface AnthropicCompatibleOptions {
  /** Origin of the endpoint; `/v1/messages` is appended. */
  baseUrl?: string
  apiKey: string
  model: string
  /** Used instead of `model` when a request carries an image. */
  visionModel?: string
  timeoutMs?: number
  /** Waits between attempts; the list length is the number of retries. */
  retryDelaysMs?: number[]
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

/** The wire shape of `POST /v1/messages` (request side), as far as the app uses it. */
interface MessagesRequestBody {
  model: string
  max_tokens: number
  system: string
  messages: { role: string; content: string | unknown[] }[]
  tools?: { name: string; description: string; input_schema: Record<string, unknown> }[]
  tool_choice?: { type: 'auto' | 'none' }
  temperature?: number
  stream?: boolean
}

/** One server-sent event of a streamed answer, as far as the adapter reads it. */
interface StreamEvent {
  type?: string
  index?: number
  message?: { model?: string; usage?: { input_tokens?: number; output_tokens?: number } }
  content_block?: { type?: string; text?: string; id?: string; name?: string }
  delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string | null }
  usage?: { input_tokens?: number; output_tokens?: number }
}

interface MessagesResponseBody {
  model?: string
  stop_reason?: string | null
  content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[]
  usage?: { input_tokens?: number; output_tokens?: number }
}

/**
 * Speaks the Anthropic Messages API over native `fetch`, to Anthropic or to
 * any endpoint that mirrors it (MiniMax's Anthropic-compatible endpoint). A
 * 429, a 5xx, a network failure or a timeout is retried with backoff; any
 * other failure, and the last retry, become `LlmUnavailableError` (503).
 * The key travels only in the `x-api-key` header; nothing of a request or
 * an answer is logged here.
 */
export class AnthropicCompatibleProvider extends LlmProvider {
  readonly name = 'anthropic'
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly retryDelaysMs: number[]
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>

  constructor(private readonly options: AnthropicCompatibleOptions) {
    super()
    this.baseUrl = (options.baseUrl || LLM_DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.timeoutMs = options.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS
    this.retryDelaysMs = options.retryDelaysMs ?? LLM_RETRY_DELAYS_MS
    this.fetchImpl = options.fetchImpl ?? fetch
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  /** The model a request goes to: the vision model when it carries an image and one is set. */
  modelFor(request: Pick<LlmRequest, 'messages'>): string {
    if (hasImageInput(request) && this.options.visionModel) return this.options.visionModel
    return this.options.model
  }

  async complete(request: LlmRequest): Promise<LlmCompletion> {
    const response = await this.send(this.body(request, false))
    let parsed: MessagesResponseBody
    try {
      parsed = (await response.json()) as MessagesResponseBody
    } catch {
      throw new LlmUnavailableError('llm answered with a body that is not json', undefined, true)
    }
    return this.completionOf(parsed, request)
  }

  async *stream(request: LlmRequest, options: LlmStreamOptions = {}): AsyncIterable<LlmDelta> {
    const response = await this.send(this.body(request, true))
    if (!response.body) {
      throw new LlmUnavailableError('llm answered without a body', undefined, true)
    }

    let model = this.modelFor(request)
    let stopReason: LlmStopReason = 'end_turn'
    let inputTokens = 0
    let outputTokens = 0
    const text: string[] = []
    const toolCalls: LlmToolCall[] = []
    const openBlocks = new Map<number, { id: string; name: string; json: string }>()
    let stopped = false

    for await (const event of parseSseStream(response.body)) {
      let data: StreamEvent
      try {
        data = JSON.parse(event.data) as StreamEvent
      } catch {
        continue
      }
      switch (data.type) {
        case 'message_start':
          model = data.message?.model ?? model
          inputTokens = data.message?.usage?.input_tokens ?? inputTokens
          outputTokens = data.message?.usage?.output_tokens ?? outputTokens
          options.onUsage?.({ inputTokens, outputTokens }, model)
          break
        case 'content_block_start':
          if (data.content_block?.type === 'tool_use') {
            openBlocks.set(data.index ?? -1, {
              id: String(data.content_block.id ?? ''),
              name: String(data.content_block.name ?? ''),
              json: '',
            })
          } else if (data.content_block?.type === 'text' && data.content_block.text) {
            text.push(data.content_block.text)
            yield { type: 'text', text: data.content_block.text }
          }
          break
        case 'content_block_delta':
          if (data.delta?.type === 'text_delta' && typeof data.delta.text === 'string') {
            text.push(data.delta.text)
            yield { type: 'text', text: data.delta.text }
          } else if (data.delta?.type === 'input_json_delta') {
            const block = openBlocks.get(data.index ?? -1)
            if (block) block.json += String(data.delta.partial_json ?? '')
          }
          break
        case 'content_block_stop': {
          const block = openBlocks.get(data.index ?? -1)
          if (block) {
            openBlocks.delete(data.index ?? -1)
            const toolCall = { id: block.id, name: block.name, input: parseToolInput(block.json) }
            toolCalls.push(toolCall)
            yield { type: 'tool_call', toolCall }
          }
          break
        }
        case 'message_delta':
          stopReason = stopReasonOf(data.delta?.stop_reason)
          outputTokens = data.usage?.output_tokens ?? outputTokens
          inputTokens = data.usage?.input_tokens ?? inputTokens
          options.onUsage?.({ inputTokens, outputTokens }, model)
          break
        case 'message_stop':
          stopped = true
          break
        case 'error':
          // The input it used was reported at message_start (onUsage); the caller charges it.
          throw new LlmUnavailableError('llm stream reported an error', undefined, true)
        default:
          break
      }
    }
    // A body that ends without message_stop is a cut connection, not an answer.
    if (!stopped) {
      throw new LlmUnavailableError('llm stream ended before message_stop', undefined, true)
    }
    yield {
      type: 'done',
      completion: {
        content: text.join(''),
        toolCalls,
        usage: { inputTokens, outputTokens },
        model,
        stopReason,
      },
    }
  }

  private body(request: LlmRequest, stream: boolean): MessagesRequestBody {
    const body: MessagesRequestBody = {
      model: this.modelFor(request),
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: wireContent(message),
      })),
    }
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }))
      body.tool_choice = { type: request.toolChoice ?? 'auto' }
    }
    if (request.temperature !== undefined) body.temperature = request.temperature
    if (stream) body.stream = true
    return body
  }

  /** Sends the request, retrying what is worth retrying; answers the `Response` of the first success. */
  private async send(body: MessagesRequestBody): Promise<Response> {
    const url = `${this.baseUrl}/v1/messages`
    const payload = JSON.stringify(body)
    for (let attempt = 0; ; attempt += 1) {
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'accept': body.stream ? 'text/event-stream' : 'application/json',
            'x-api-key': this.options.apiKey,
            'anthropic-version': LLM_ANTHROPIC_VERSION,
          },
          body: payload,
          signal: AbortSignal.timeout(this.timeoutMs),
        })
      } catch (error) {
        if (attempt < this.retryDelaysMs.length) {
          await this.sleep(this.retryDelaysMs[attempt])
          continue
        }
        // A timeout may have reached the model; a refused connection did not.
        const name = (error as Error).name
        throw new LlmUnavailableError(
          `llm unreachable: ${name}`,
          undefined,
          name === 'TimeoutError'
        )
      }
      if (response.ok) return response
      const retryable = response.status === 429 || response.status >= 500
      if (retryable && attempt < this.retryDelaysMs.length) {
        await response.body?.cancel().catch(() => undefined)
        await this.sleep(this.retryDelaysMs[attempt])
        continue
      }
      await response.body?.cancel().catch(() => undefined)
      throw new LlmUnavailableError(`llm answered ${response.status}`, response.status)
    }
  }

  private completionOf(body: MessagesResponseBody, request: LlmRequest): LlmCompletion {
    const blocks = Array.isArray(body.content) ? body.content : []
    const content = blocks
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('')
    const toolCalls: LlmToolCall[] = blocks
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({
        id: String(block.id ?? ''),
        name: String(block.name ?? ''),
        input: isRecord(block.input) ? block.input : {},
      }))
    return {
      content,
      toolCalls,
      usage: {
        inputTokens: Number(body.usage?.input_tokens ?? 0),
        outputTokens: Number(body.usage?.output_tokens ?? 0),
      },
      model: body.model ?? this.modelFor(request),
      stopReason: stopReasonOf(body.stop_reason),
    }
  }
}

/** A message's content in the Messages API shape. */
function wireContent(message: LlmMessage): string | unknown[] {
  if (typeof message.content === 'string') return message.content
  return message.content.map((block: LlmContentBlock) => {
    switch (block.type) {
      case 'text':
        return { type: 'text', text: block.text }
      case 'image':
        return {
          type: 'image',
          source: { type: 'base64', media_type: block.mimeType, data: block.data },
        }
      case 'tool_use':
        return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
      case 'tool_result':
        return {
          type: 'tool_result',
          tool_use_id: block.toolUseId,
          content: block.content,
          ...(block.isError ? { is_error: true } : {}),
        }
    }
  })
}

function stopReasonOf(value: unknown): LlmStopReason {
  switch (value) {
    case 'max_tokens':
    case 'tool_use':
    case 'stop_sequence':
    case 'refusal':
      return value
    default:
      return 'end_turn'
  }
}

/** A streamed tool input: the concatenated JSON deltas, or an empty object when they do not parse. */
function parseToolInput(json: string): Record<string, unknown> {
  if (json.trim() === '') return {}
  try {
    const parsed = JSON.parse(json)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
