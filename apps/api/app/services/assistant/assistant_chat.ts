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
import { LlmClient } from '#services/llm/llm_client'
import type {
  LlmCompletion,
  LlmContentBlock,
  LlmMessage,
  LlmToolResultBlock,
} from '#services/llm/llm_provider'
import { Clock } from '#services/clock'
import { TripViews } from '#services/trip_views'
import {
  ASSISTANT_HISTORY_MESSAGES,
  ASSISTANT_MAX_OUTPUT_TOKENS_PER_TURN,
  ASSISTANT_MAX_TOKENS_PER_CALL,
  ASSISTANT_MAX_TOOL_CALLS,
} from '#config/assistant'

export interface ChatTurn {
  user: User
  trip: Trip
  /** The caller's own conversation row (already checked). */
  conversation: Record<string, unknown>
  text: string
  i18n: I18n
}

const LIMIT_REACHED =
  'Tool call limit reached for this message. Answer the member now with what you already know.'

/**
 * One turn of the chat: the member's message, then the tool loop. Every
 * model call goes through `LlmClient` (cap reservation, usage row,
 * provider errors as 503). The model may call up to six tools per turn;
 * after that it must answer without tools. Text is streamed as it comes;
 * each proposal a write tool records is streamed as a `proposal` event.
 *
 * A turn that fails before anything was streamed (over the cap, provider
 * down) leaves no trace and rethrows, so the route answers with the error
 * status; a turn that fails later keeps what was said and ends with an
 * `error` event. Prompts, answers and tool payloads are never logged.
 */
@inject()
export class AssistantChat {
  constructor(
    private readonly llm: LlmClient,
    private readonly toolbox: AssistantToolbox,
    private readonly views: TripViews,
    private readonly clock: Clock
  ) {}

  async *turn(turn: ChatTurn): AsyncGenerator<AssistantStreamEvent> {
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
    const ctx: ToolContext = { user, trip, conversationId, messageId, i18n }

    const { date: today } = await this.views.today(trip)
    const system = assistantSystemPrompt({ locale: user.locale, today })
    const messages: LlmMessage[] = [...history, { role: 'user', content: text }]
    let answer = ''
    let streamed = false
    let toolCalls = 0
    let outputTokens = 0

    try {
      for (;;) {
        const mustAnswer = toolCalls >= ASSISTANT_MAX_TOOL_CALLS
        const budget = ASSISTANT_MAX_OUTPUT_TOKENS_PER_TURN - outputTokens
        if (budget <= 0) break
        let completion: LlmCompletion | null = null
        for await (const delta of this.llm.stream(
          { user, tripId: trip.id },
          {
            purpose: 'chat',
            system,
            messages,
            tools: this.toolbox.definitions(),
            toolChoice: mustAnswer ? 'none' : 'auto',
            maxTokens: Math.min(ASSISTANT_MAX_TOKENS_PER_CALL, budget),
          }
        )) {
          if (delta.type === 'text') {
            answer += delta.text
            streamed = true
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
        messages.push({ role: 'assistant', content: assistantBlocks })

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
          toolCalls += 1
          const outcome = await this.toolbox.run(ctx, call)
          if (outcome.action) {
            streamed = true
            yield { type: 'proposal', action: outcome.action }
          }
          results.push({
            type: 'tool_result',
            toolUseId: call.id,
            content: outcome.content,
            ...(outcome.isError ? { isError: true } : {}),
          })
        }
        messages.push({ role: 'user', content: results })
      }
    } catch (error) {
      if (!streamed) {
        // Nothing reached the member: the turn leaves no trace and the route answers the error.
        await db.from('ai_messages').whereIn('id', [userMessage.id, assistantMessage.id]).delete()
        if (titled) {
          await db.from('ai_conversations').where('id', conversationId).update({ title: null })
        }
        throw error
      }
      await this.saveAnswer(messageId, answer)
      yield this.errorEvent(error, i18n)
      return
    }

    await this.saveAnswer(messageId, answer)
    yield { type: 'done', conversationId, messageId, title }
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
