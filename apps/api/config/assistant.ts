/**
 * Limits of the trip assistant (WP 3.1). Not secrets: tune them here. The
 * monthly token cap and the per-account throttle that also apply live with
 * every other LLM call (`config/plans.ts`, `start/limiter.ts`).
 */
import { AI_ACTION_TTL_HOURS, ASSISTANT_MAX_TOOL_CALLS_PER_TURN } from '@monkitrips/shared'

/** Tool calls one member message may trigger; the next model call must answer without tools. */
export const ASSISTANT_MAX_TOOL_CALLS = ASSISTANT_MAX_TOOL_CALLS_PER_TURN

/** Output tokens one member message may use across every model call of its turn. */
export const ASSISTANT_MAX_OUTPUT_TOKENS_PER_TURN = 4_096

/** Output tokens one model call of the turn may use (never more than what the turn has left). */
export const ASSISTANT_MAX_TOKENS_PER_CALL = 1_024

/** Earlier messages of the conversation sent back to the model with a new one. */
export const ASSISTANT_HISTORY_MESSAGES = 20

/** Changes one `propose_event_changes` call may carry. */
export const ASSISTANT_MAX_EVENT_CHANGES = 10

/** Events, documents or tasks one read tool returns at most. */
export const ASSISTANT_MAX_LIST_ROWS = 100

/**
 * The longest text one tool result may hand the model, `<data>` wrapper
 * included. Results are resent with every later call of the turn, so an
 * unbounded list (a hundred events with long notes) would eat a month of
 * the free plan's tokens in a few messages. Lists past it are cut with
 * `truncated: true` and a hint to narrow the request.
 */
export const ASSISTANT_TOOL_RESULT_MAX_CHARS = 16_000

/** Free text of one row in a tool result: notes, then addresses and place names. */
export const ASSISTANT_NOTES_MAX_CHARS = 300
export const ASSISTANT_ADDRESS_MAX_CHARS = 200

/** How often the chat stream writes a `: ping` comment, so proxies keep it open. */
export const ASSISTANT_SSE_PING_MS = 15_000

/** How long a proposal waits for the member before it expires. */
export const AI_ACTION_TTL_MS = AI_ACTION_TTL_HOURS * 60 * 60 * 1000
