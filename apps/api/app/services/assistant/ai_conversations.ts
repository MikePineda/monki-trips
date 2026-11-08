import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  AI_CONVERSATION_TITLE_LENGTH,
  type AiConversation,
  type AiConversationDetail,
} from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type Trip from '#models/trip'
import type User from '#models/user'
import { aiActionWire, aiConversationWire, aiMessageWire } from '#services/assistant/ai_action_wire'
import { Clock } from '#services/clock'

type Row = Record<string, unknown>

/** The title a conversation takes from its first message: the first line, cut at a word. */
export function titleFromMessage(text: string): string {
  const line = text.trim().split(/\r?\n/)[0].replace(/\s+/g, ' ')
  return line.slice(0, AI_CONVERSATION_TITLE_LENGTH).trimEnd()
}

/**
 * Conversations with the assistant. Each one belongs to the trip and to the
 * account that started it: anyone else, a member of the same trip
 * included, gets 404 as if it did not exist. Proposals past their expiry
 * are marked `expired` whenever a conversation or an action is read.
 */
@inject()
export class AiConversations {
  constructor(private readonly clock: Clock) {}

  async list(user: User, trip: Trip): Promise<AiConversation[]> {
    const rows = (await db
      .from('ai_conversations')
      .where('trip_id', trip.id)
      .where('user_id', user.id)
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')) as Row[]
    return rows.map(aiConversationWire)
  }

  async create(user: User, trip: Trip, title: string | null): Promise<AiConversation> {
    const now = this.clock.now()
    const [row] = (await db
      .table('ai_conversations')
      .insert({
        trip_id: trip.id,
        user_id: user.id,
        title,
        created_at: now,
        updated_at: now,
      })
      .returning('*')) as Row[]
    return aiConversationWire(row)
  }

  /** The caller's own conversation in this trip, else 404. */
  async find(
    user: User,
    trip: Trip,
    id: string,
    client: QueryClientContract | TransactionClientContract = db.connection()
  ): Promise<Row> {
    const row = (await client
      .from('ai_conversations')
      .where('id', id)
      .where('trip_id', trip.id)
      .where('user_id', user.id)
      .first()) as Row | null
    if (!row) throw new ApiException('E_ROW_NOT_FOUND')
    return row
  }

  async detail(user: User, trip: Trip, id: string): Promise<AiConversationDetail> {
    const conversation = await this.find(user, trip, id)
    await this.expireDue(trip.id)
    const messages = (await db
      .from('ai_messages')
      .where('conversation_id', id)
      .orderBy('seq', 'asc')) as Row[]
    const actions = (await db
      .from('ai_actions')
      .where('conversation_id', id)
      .orderBy('seq', 'asc')) as Row[]
    return {
      ...aiConversationWire(conversation),
      messages: messages.map(aiMessageWire),
      actions: actions.map(aiActionWire),
    }
  }

  /** Deletes the caller's conversation with its messages and proposals; what was accepted stays in the trip. */
  async destroy(user: User, trip: Trip, id: string): Promise<void> {
    await this.find(user, trip, id)
    await db.from('ai_conversations').where('id', id).delete()
  }

  /** Marks proposals of the trip whose time ran out as `expired`. */
  async expireDue(
    tripId: string,
    client: QueryClientContract | TransactionClientContract = db.connection()
  ): Promise<void> {
    const now = this.clock.now()
    await client
      .from('ai_actions')
      .where('trip_id', tripId)
      .where('status', 'proposed')
      .where('expires_at', '<=', now)
      .update({ status: 'expired', updated_at: now })
  }
}
