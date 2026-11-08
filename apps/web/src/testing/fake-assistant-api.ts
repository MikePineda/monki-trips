import type {
  AiAction,
  AiConversation,
  AiConversationDetail,
  AiProposal,
  AssistantStreamEvent,
} from '@monkitrips/shared'
import type {
  AcceptedAiAction,
  AssistantApi,
  SendAssistantMessage,
} from '../app/core/api/assistant-api'
import { FakeApi } from './fake-api'

/** A synthetic conversation of trip `trip-1`. */
export function aiConversation(overrides: Partial<AiConversation> = {}): AiConversation {
  return {
    id: 'conv-1',
    tripId: 'trip-1',
    title: 'Tomorrow',
    createdAt: '2026-11-07T09:00:00.000Z',
    updatedAt: '2026-11-07T09:00:00.000Z',
    ...overrides,
  }
}

/** A synthetic expense proposal: 350 THB of food, in AUD at a made-up rate. */
export const EXPENSE_PROPOSAL: AiProposal = {
  kind: 'expense',
  expenseId: 'exp-1',
  amountMinor: 35_000,
  currency: 'THB',
  categoryId: 'cat-food',
  categoryKey: 'food',
  categoryName: null,
  spentOn: '2026-11-07',
  description: 'Pad thai',
  baseCurrency: 'AUD',
  baseAmountMinor: 1_556,
  fxRate: '22.5',
  fxRateDate: '2026-11-07',
  fxSource: 'frankfurter',
}

export function aiAction(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: 'act-1',
    tripId: 'trip-1',
    conversationId: 'conv-1',
    messageId: 'msg-2',
    tool: 'add_expense',
    status: 'proposed',
    proposal: EXPENSE_PROPOSAL,
    expiresAt: '2026-11-08T12:00:00.000Z',
    decidedAt: null,
    errorCode: null,
    createdAt: '2026-11-07T09:00:00.000Z',
    ...overrides,
  }
}

/** A detail with one exchange (member then Kiko) and the given proposals. */
export function aiConversationDetail(
  overrides: Partial<AiConversationDetail> = {}
): AiConversationDetail {
  return {
    ...aiConversation(),
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'Log 350 baht of pad thai',
        createdAt: '2026-11-07T09:00:00.000Z',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Here is the expense to confirm.',
        createdAt: '2026-11-07T09:00:01.000Z',
      },
    ],
    actions: [],
    ...overrides,
  }
}

/**
 * One chat turn a spec drives by hand: `emit` hands the next event to
 * the page, `end` closes the stream, `cut` breaks it. Aborting the
 * request's signal ends the iteration with an AbortError, like `fetch`.
 */
export class FakeAssistantStream implements AsyncIterable<AssistantStreamEvent> {
  private readonly queue: (AssistantStreamEvent | { cut: unknown } | 'end')[] = []
  private wake: (() => void) | null = null
  aborted = false

  constructor(private readonly signal: AbortSignal) {
    signal.addEventListener('abort', () => {
      this.aborted = true
      this.notify()
    })
  }

  emit(...events: AssistantStreamEvent[]): void {
    this.queue.push(...events)
    this.notify()
  }

  end(): void {
    this.queue.push('end')
    this.notify()
  }

  cut(error: unknown): void {
    this.queue.push({ cut: error })
    this.notify()
  }

  async *[Symbol.asyncIterator](): AsyncIterator<AssistantStreamEvent> {
    for (;;) {
      if (this.signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      const next = this.queue.shift()
      if (next === undefined) {
        await new Promise<void>((resolve) => (this.wake = resolve))
        continue
      }
      if (next === 'end') {
        return
      }
      if ('cut' in next) {
        throw next.cut
      }
      yield next
    }
  }

  private notify(): void {
    const wake = this.wake
    this.wake = null
    wake?.()
  }
}

/** In-memory stand-in for the assistant routes. */
export class FakeAssistantApi extends FakeApi implements AssistantApi {
  conversations: AiConversation[] = []
  readonly details = new Map<string, AiConversationDetail>()
  readonly sent: Omit<SendAssistantMessage, 'signal'>[] = []
  readonly streams: FakeAssistantStream[] = []
  /** When set, the next `send` rejects with it before any event (402, 429). */
  sendFailure: unknown = null
  /** When set, the next `accept` rejects with it (409). */
  acceptFailure: unknown = null
  private created = 0

  list(tripId: string): Promise<AiConversation[]> {
    return this.run(`list:${tripId}`, () => this.conversations.filter((c) => c.tripId === tripId))
  }

  create(tripId: string): Promise<AiConversation> {
    return this.run(`create:${tripId}`, () => {
      this.created += 1
      const conversation = aiConversation({ id: `conv-new-${this.created}`, tripId, title: null })
      this.conversations.unshift(conversation)
      return conversation
    })
  }

  detail(tripId: string, conversationId: string): Promise<AiConversationDetail> {
    return this.run(`detail:${conversationId}`, () => {
      const detail = this.details.get(conversationId)
      if (!detail) {
        throw new Error(`no detail scripted for ${conversationId}`)
      }
      return structuredClone(detail)
    })
  }

  remove(tripId: string, conversationId: string): Promise<void> {
    return this.run(`remove:${conversationId}`, () => {
      this.conversations = this.conversations.filter((c) => c.id !== conversationId)
      this.details.delete(conversationId)
    })
  }

  send(message: SendAssistantMessage): Promise<AsyncIterable<AssistantStreamEvent>> {
    return this.run(`send:${message.conversationId}`, () => {
      const { signal, ...rest } = message
      this.sent.push(rest)
      if (this.sendFailure !== null) {
        const failure = this.sendFailure
        this.sendFailure = null
        throw failure
      }
      const stream = new FakeAssistantStream(signal)
      this.streams.push(stream)
      return stream
    })
  }

  accept(tripId: string, actionId: string): Promise<AcceptedAiAction> {
    return this.run(`accept:${actionId}`, () => {
      if (this.acceptFailure !== null) {
        const failure = this.acceptFailure
        this.acceptFailure = null
        throw failure
      }
      const action = this.findAction(actionId)
      return {
        action: { ...action, status: 'accepted', decidedAt: '2026-11-07T12:00:00.000Z' },
        results: [],
      }
    })
  }

  reject(tripId: string, actionId: string): Promise<AiAction> {
    return this.run(`reject:${actionId}`, () => ({
      ...this.findAction(actionId),
      status: 'rejected',
      decidedAt: '2026-11-07T12:00:00.000Z',
    }))
  }

  /** The latest stream, once the page opened it. */
  get stream(): FakeAssistantStream {
    const stream = this.streams.at(-1)
    if (!stream) {
      throw new Error('no stream open')
    }
    return stream
  }

  private findAction(actionId: string): AiAction {
    for (const detail of this.details.values()) {
      const found = detail.actions.find((action) => action.id === actionId)
      if (found) {
        return found
      }
    }
    return aiAction({ id: actionId })
  }
}
