import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { I18n } from '@adonisjs/i18n'
import type { AssistantStreamEvent, ErrorCode } from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type Trip from '#models/trip'
import type User from '#models/user'
import type { ToolContext } from '#services/assistant/assistant_tool'
import { assistantSystemPrompt } from '#services/assistant/assistant_prompt'
import { AssistantToolbox } from '#services/assistant/assistant_toolbox'
import { titleFromMessage } from '#services/assistant/ai_conversations'
import { LlmClient, type LlmCaller } from '#services/llm/llm_client'
import type {
  LlmCompletion,
  LlmContentBlock,
  LlmDelta,
  LlmMessage,
  LlmRequest,
  LlmToolResultBlock,
} from '#services/llm/llm_provider'
import { Clock } from '#services/clock'
import { TripViews } from '#services/trip_views'
import {
  ASSISTANT_HISTORY_MESSAGES,
  ASSISTANT_MAX_OUTPUT_TOKENS_PER_TURN,
  ASSISTANT_MAX_TOKENS_PER_CALL,
  ASSISTANT_MAX_TOOL_CALLS,
  ASSISTANT_TOOL_CALLS_PER_TURN,
} from '#config/assistant'

export interface ChatTurn {
  user: User
  trip: Trip
  /** The caller's own conversation row (already checked). */
  conversation: Record<string, unknown>
  text: string
  i18n: I18n
  /** Aborted when the member goes away: the turn makes no further model call. */
  signal?: AbortSignal
}

const LIMIT_REACHED =
  'Tool call limit reached for this message. Answer the member now with what you already know.'

/** Everything a running turn carries between model calls. */
interface TurnState {
  caller: LlmCaller
  ctx: ToolContext
  system: string
  messages: LlmMessage[]
  title: string
  signal?: AbortSignal
}

/**
 * One turn of the chat: the member's message, then the tool loop. Every
 * model call goes through `LlmClient` (cap reservation, usage row,
 * provider errors as 503). The model may call up to six tools per turn;
 * after that it must answer without tools. Text is streamed as it comes;
 * each proposal a write tool records is streamed as a `proposal` event.
 *
 * `start` stores the member's message and reserves the first model call:
 * when that reservation is refused (402 over the cap) the turn leaves no
 * trace and `start` rejects, so the route answers with the status. Once
 * it resolves, every later failure ends the stream with an `error` event.
 * Whatever happens, including a member who stops the stream, the text
 * streamed so far is stored as the answer. Prompts, answers and tool
 * payloads are never logged.
 */
@inject()
export class AssistantChat {
  constructor(
    private readonly llm: LlmClient,
    private readonly toolbox: AssistantToolbox,
    private readonly views: TripViews,
    private readonly clock: Clock
  ) {}

  async start(turn: ChatTurn): Promise<AsyncGenerator<AssistantStreamEvent>> {
    const { user, trip, conversation, text, i18n } = turn
    const conversationId = String(conversation['id'])
    const history = await this.history(conversationId)
    const now = this.clock.now()
    const titled = conversation['title'] === null
    const title = titled ? titleFromMessage(text) : (conversation['title'] as string)
    const [userMessage] = await db
      .table('ai_messages')
      .insert({
        conversation_id: conversationId,
        trip_id: trip.id,
        role: 'user',
        content: text,
        created_at: now,
      })
      .returning('id')
    const [assistantMessage] = await db
      .table('ai_messages')
      .insert({
        conversation_id: conversationId,
        trip_id: trip.id,
        role: 'assistant',
        content: '',
        created_at: now,
      })
      .returning('id')
    await db.from('ai_conversations').where('id', conversationId).update({ title, updated_at: now })
    const messageId = String(assistantMessage.id)

    const { date: today } = await this.views.today(trip)
    const state: TurnState = {
      caller: { user, tripId: trip.id },
      ctx: { user, trip, conversationId, messageId, i18n },
      system: assistantSystemPrompt({ locale: user.locale, today }),
      messages: [...history, { role: 'user', content: text }],
      title,
      signal: turn.signal,
    }

    let first: AsyncIterable<LlmDelta>
    try {
      first = await this.llm.openStream(state.caller, this.request(state, 0, 0))
    } catch (error) {
      // Refused before any model call: the turn leaves no trace and the route answers the error.
      await db.from('ai_messages').whereIn('id', [userMessage.id, assistantMessage.id]).delete()
      if (titled) {
        await db.from('ai_conversations').where('id', conversationId).update({ title: null })
      }
      throw error
    }
    return this.run(state, first)
  }

  private async *run(
    state: TurnState,
    first: AsyncIterable<LlmDelta>
  ): AsyncGenerator<AssistantStreamEvent> {
    const { ctx } = state
    let answer = ''
    let outcome: AssistantStreamEvent | null = null
    let pending: AsyncIterable<LlmDelta> | null = first
    let toolCalls = 0
    const callsByTool = new Map<string, number>()
    let outputTokens = 0
    try {
      for (;;) {
        const mustAnswer = toolCalls >= ASSISTANT_MAX_TOOL_CALLS
        const budget = ASSISTANT_MAX_OUTPUT_TOKENS_PER_TURN - outputTokens
        if (budget <= 0 || state.signal?.aborted) break
        const deltas: AsyncIterable<LlmDelta> =
          pending ?? this.llm.stream(state.caller, this.request(state, toolCalls, outputTokens))
        pending = null
        let completion: LlmCompletion | null = null
        for await (const delta of deltas) {
          if (delta.type === 'text') {
            answer += delta.text
            yield { type: 'text', text: delta.text }
          } else if (delta.type === 'done') {
            completion = delta.completion
          }
        }
        if (!completion) break
        outputTokens += completion.usage.outputTokens
        if (mustAnswer || completion.toolCalls.length === 0) break

        const assistantBlocks: LlmContentBlock[] = []
        if (completion.content) assistantBlocks.push({ type: 'text', text: completion.content })
        for (const call of completion.toolCalls) {
          assistantBlocks.push({
            type: 'tool_use',
            id: call.id,
            name: call.name,
            input: call.input,
          })
        }
        state.messages.push({ role: 'assistant', content: assistantBlocks })

        const results: LlmToolResultBlock[] = []
        for (const call of completion.toolCalls) {
          if (toolCalls >= ASSISTANT_MAX_TOOL_CALLS) {
            results.push({
              type: 'tool_result',
              toolUseId: call.id,
              content: LIMIT_REACHED,
              isError: true,
            })
            continue
          }
          const used = callsByTool.get(call.name) ?? 0
          const allowed = ASSISTANT_TOOL_CALLS_PER_TURN[call.name]
          if (allowed !== undefined && used >= allowed) {
            results.push({
              type: 'tool_result',
              toolUseId: call.id,
              content: `${call.name} can run ${allowed} time(s) per turn. Ask the member to send the next one in a new message.`,
              isError: true,
            })
            continue
          }
          callsByTool.set(call.name, used + 1)
          toolCalls += 1
          const outcomeOfTool = await this.toolbox.run(ctx, call)
          if (outcomeOfTool.action) yield { type: 'proposal', action: outcomeOfTool.action }
          results.push({
            type: 'tool_result',
            toolUseId: call.id,
            content: outcomeOfTool.content,
            ...(outcomeOfTool.isError ? { isError: true } : {}),
          })
        }
        state.messages.push({ role: 'user', content: results })
      }
      outcome = {
        type: 'done',
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        title: state.title,
      }
    } catch (error) {
      outcome = this.errorEvent(error, ctx.i18n)
    } finally {
      // Also when the member stops the stream: what was streamed stays the answer.
      await this.saveAnswer(ctx.messageId, answer)
    }
    if (!state.signal?.aborted) yield outcome
  }

  /** The next model call; a copy of the messages, so each call keeps what it was sent. */
  private request(state: TurnState, toolCalls: number, outputTokens: number): LlmRequest {
    return {
      purpose: 'chat',
      system: state.system,
      messages: [...state.messages],
      tools: this.toolbox.definitions(),
      toolChoice: toolCalls >= ASSISTANT_MAX_TOOL_CALLS ? 'none' : 'auto',
      maxTokens: Math.min(
        ASSISTANT_MAX_TOKENS_PER_CALL,
        ASSISTANT_MAX_OUTPUT_TOKENS_PER_TURN - outputTokens
      ),
    }
  }

  /** Earlier messages as plain turns (no tool payloads: the model reads fresh data with the tools). */
  private async history(conversationId: string): Promise<LlmMessage[]> {
    const rows = (await db
      .from('ai_messages')
      .where('conversation_id', conversationId)
      .orderBy('seq', 'desc')
      .limit(ASSISTANT_HISTORY_MESSAGES)
      .select('role', 'content')) as { role: 'user' | 'assistant'; content: string }[]
    return rows
      .reverse()
      .filter((row) => row.content.trim() !== '')
      .map((row) => ({ role: row.role, content: row.content }))
  }

  private async saveAnswer(messageId: string, answer: string): Promise<void> {
    await db.from('ai_messages').where('id', messageId).update({ content: answer })
  }

  private errorEvent(error: unknown, i18n: I18n): AssistantStreamEvent {
    let code: ErrorCode = 'E_INTERNAL_SERVER_ERROR'
    if (error instanceof ApiException) {
      code = error.code as ErrorCode
    } else {
      // The kind of failure only: never the prompt, the answer or a tool payload.
      logger.error({ err: { name: (error as Error)?.name } }, 'assistant turn failed')
    }
    return { type: 'error', code, message: i18n.t(`errors.${code}`, {}, code) }
  }
}
