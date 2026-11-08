import type { AiAction, AiConversation, AiMessage } from '@monkitrips/shared'

type Row = Record<string, unknown>

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString()
}

function isoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value)
}

/** An `ai_actions` row as the API returns it: the diff, never the stored mutations or baseline. */
export function aiActionWire(row: Row): AiAction {
  return {
    id: String(row['id']),
    tripId: String(row['trip_id']),
    conversationId: String(row['conversation_id']),
    messageId: row['message_id'] ? String(row['message_id']) : null,
    tool: row['tool'] as AiAction['tool'],
    status: row['status'] as AiAction['status'],
    proposal: row['proposal'] as AiAction['proposal'],
    expiresAt: iso(row['expires_at']),
    decidedAt: isoOrNull(row['decided_at']),
    errorCode: (row['error_code'] as AiAction['errorCode']) ?? null,
    createdAt: iso(row['created_at']),
  }
}

export function aiConversationWire(row: Row): AiConversation {
  return {
    id: String(row['id']),
    tripId: String(row['trip_id']),
    title: (row['title'] as string | null) ?? null,
    createdAt: iso(row['created_at']),
    updatedAt: iso(row['updated_at']),
  }
}

export function aiMessageWire(row: Row): AiMessage {
  return {
    id: String(row['id']),
    conversationId: String(row['conversation_id']),
    role: row['role'] as AiMessage['role'],
    content: String(row['content']),
    createdAt: iso(row['created_at']),
  }
}
