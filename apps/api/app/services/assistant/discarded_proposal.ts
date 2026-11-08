/**
 * The columns of an `ai_actions` row made outside a chat (a document read
 * from its detail, `conversation_id` null) once it is closed without being
 * applied (rejected, expired, failed): the draft, the mutations and the
 * baseline hold what the booking said (code, address, cost), and no
 * conversation deletion would ever remove them, so they are cleared. The
 * row stays, with its status, as the record of the decision.
 */
export const DISCARDED_PROPOSAL_COLUMNS = {
  proposal: JSON.stringify({ kind: 'discarded' }),
  mutations: '[]',
  baseline: '[]',
} as const
