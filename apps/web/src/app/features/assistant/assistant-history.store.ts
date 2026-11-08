import { Injectable, inject } from '@angular/core'
import type { AiAction, AiConversation, AiConversationDetail, AiMessage } from '@monkitrips/shared'
import { ASSISTANT_API } from '../../core/api/assistant-api'
import type { AiConversationRecord } from '../../core/offline/ai-conversation-record'
import { OFFLINE_DB } from '../../core/offline/offline-db'

/**
 * The member's conversations on the device, so the chat reads offline:
 * the list is replaced by the server's when it answers (keeping what each
 * conversation already holds), an opened conversation keeps its messages
 * and proposals, and a turn or a decision writes the latest state back.
 * Deleting needs the server first; only then does the copy go.
 */
@Injectable({ providedIn: 'root' })
export class AssistantHistoryStore {
  private readonly api = inject(ASSISTANT_API)
  private readonly database = inject(OFFLINE_DB)

  /** Fetches the list and makes the device's copy match it. */
  async refresh(tripId: string): Promise<void> {
    const rows = await this.api.list(tripId)
    const db = await this.database
    await db.transaction('rw', db.aiConversations, async () => {
      const cached = new Map(
        (await db.aiConversations.where('tripId').equals(tripId).toArray()).map((row) => [
          row.id,
          row,
        ])
      )
      const listed = new Set(rows.map((row) => row.id))
      await db.aiConversations.bulkDelete([...cached.keys()].filter((id) => !listed.has(id)))
      await db.aiConversations.bulkPut(
        rows.map((row) => ({
          ...row,
          messages: cached.get(row.id)?.messages ?? null,
          actions: cached.get(row.id)?.actions ?? null,
        }))
      )
    })
  }

  async cached(conversationId: string): Promise<AiConversationRecord | null> {
    const db = await this.database
    return (await db.aiConversations.get(conversationId)) ?? null
  }

  async save(detail: AiConversationDetail): Promise<void> {
    const db = await this.database
    await db.aiConversations.put({ ...detail })
  }

  async saveState(
    conversation: AiConversation,
    messages: AiMessage[],
    actions: AiAction[]
  ): Promise<void> {
    await this.save({ ...conversation, messages, actions })
  }

  async remove(tripId: string, conversationId: string): Promise<void> {
    await this.api.remove(tripId, conversationId)
    const db = await this.database
    await db.aiConversations.delete(conversationId)
  }
}
