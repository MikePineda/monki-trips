import { Injectable, computed, inject, signal, untracked } from '@angular/core'
import {
  AI_ACTION_STATUSES,
  type AiAction,
  type AiActionStatus,
  type AiConversation,
  type AiConversationDetail,
  type AiMessage,
  type AssistantStreamEvent,
} from '@monkitrips/shared'
import { ApiFailure, toApiFailure } from '../../core/api/api-failure'
import { ASSISTANT_API } from '../../core/api/assistant-api'
import { CLOCK } from '../../core/offline/clock'
import { OnlineStore } from '../../core/offline/online.store'
import { SyncService } from '../../core/offline/sync.service'
import { SessionStore } from '../../core/session/session.store'
import { AssistantHistoryStore } from './assistant-history.store'

export type ChatAuthor = 'member' | 'assistant'

/** One turn on screen: the stored message, or the one being written right now. */
export interface ChatEntry {
  id: string
  author: ChatAuthor
  text: string
  createdAt: string
  /** The answer is still arriving. */
  streaming: boolean
}

/** A proposal and the answer it belongs to. */
export interface ChatProposal {
  action: AiAction
  entryId: string | null
}

/**
 * `idle`; `loading` a conversation; `thinking` while Kiko works with
 * nothing new to show (before the first words, and after a proposal
 * until the next ones); `streaming` while the words arrive.
 */
export type ChatPhase = 'idle' | 'loading' | 'thinking' | 'streaming'

/** What `send` did: the turn ran (whatever its outcome), or it was refused before any word. */
export type SendOutcome = 'sent' | 'refused'

let localIds = 0

function localId(): string {
  localIds += 1
  return `local-${localIds}`
}

/**
 * One conversation with Kiko on screen. Opening reads the device's copy
 * first and then the server's; a turn creates the conversation when there
 * is none, streams the answer in, keeps whatever arrived when it is
 * stopped or cut, and saves the result to the device. A decision on a
 * proposal is the server's: accepting pulls so the change appears
 * everywhere, a stale or closed one takes the status the server gives.
 * Message text is never logged.
 */
@Injectable()
export class AssistantChatStore {
  private readonly api = inject(ASSISTANT_API)
  private readonly history = inject(AssistantHistoryStore)
  private readonly sync = inject(SyncService)
  private readonly session = inject(SessionStore)
  private readonly online = inject(OnlineStore).online
  private readonly clock = inject(CLOCK)

  readonly conversation = signal<AiConversation | null>(null)
  readonly entries = signal<ChatEntry[]>([])
  readonly proposals = signal<ChatProposal[]>([])
  readonly phase = signal<ChatPhase>('idle')
  readonly failure = signal<ApiFailure | null>(null)
  /** The member stopped the last answer. */
  readonly stopped = signal(false)
  readonly deciding = signal<ReadonlySet<string>>(new Set())
  readonly decisionFailures = signal<ReadonlyMap<string, ApiFailure>>(new Map())
  /** The last answer that arrived in full, for the polite live region. */
  readonly answered = signal('')

  readonly busy = computed(() => this.phase() === 'thinking' || this.phase() === 'streaming')

  private controller: AbortController | null = null
  private opened = 0

  /** Shows a conversation: the device's copy at once, then the server's when online. */
  async open(conversationId: string, tripId: string): Promise<void> {
    const mine = (this.opened += 1)
    this.reset()
    this.phase.set('loading')
    try {
      const cached = await this.history.cached(conversationId)
      if (mine !== this.opened) return
      if (cached) {
        this.show(cached, cached.messages ?? [], cached.actions ?? [])
      }
      if (!untracked(this.online)) return
      const detail = await this.api.detail(tripId, conversationId)
      if (mine !== this.opened) return
      this.show(detail, detail.messages, detail.actions)
      await this.history.save(detail)
    } catch (error) {
      if (mine === this.opened) this.failure.set(toApiFailure(error))
    } finally {
      if (mine === this.opened) this.phase.set('idle')
    }
  }

  /** Back to an empty, unsaved conversation ("New chat"). */
  reset(): void {
    this.controller?.abort()
    this.controller = null
    this.conversation.set(null)
    this.entries.set([])
    this.proposals.set([])
    this.failure.set(null)
    this.stopped.set(false)
    this.decisionFailures.set(new Map())
    this.answered.set('')
    this.phase.set('idle')
  }

  /**
   * One turn. Refused before any word (no connection, over the monthly
   * allowance, too many in a row): the member's message leaves the screen
   * so the page can give it back to the composer.
   */
  async send(tripId: string, text: string): Promise<SendOutcome> {
    if (this.busy()) return 'refused'
    this.opened += 1
    this.failure.set(null)
    this.stopped.set(false)
    this.answered.set('')
    let conversation = this.conversation()
    const member: ChatEntry = {
      id: localId(),
      author: 'member',
      text,
      createdAt: this.clock(),
      streaming: false,
    }
    const answer: ChatEntry = {
      id: localId(),
      author: 'assistant',
      text: '',
      createdAt: this.clock(),
      streaming: true,
    }
    this.entries.update((entries) => [...entries, member, answer])
    this.phase.set('thinking')
    const controller = new AbortController()
    this.controller = controller

    let events: AsyncIterable<AssistantStreamEvent>
    try {
      if (!conversation) {
        conversation = await this.api.create(tripId)
        this.conversation.set(conversation)
      }
      events = await this.api.send({
        tripId,
        conversationId: conversation.id,
        text,
        signal: controller.signal,
      })
    } catch (error) {
      this.entries.update((entries) =>
        entries.filter((entry) => entry.id !== member.id && entry.id !== answer.id)
      )
      if (!controller.signal.aborted) this.failure.set(toApiFailure(error))
      this.finish(controller)
      return 'refused'
    }

    let answerId = answer.id
    try {
      for await (const event of events) {
        switch (event.type) {
          case 'text':
            this.updateEntry(answerId, (entry) => ({ ...entry, text: entry.text + event.text }))
            this.phase.set('streaming')
            break
          case 'proposal':
            this.proposals.update((list) => [
              ...list.filter((item) => item.action.id !== event.action.id),
              { action: event.action, entryId: answerId },
            ])
            this.phase.set('thinking')
            break
          case 'done': {
            const previous = answerId
            answerId = event.messageId
            this.updateEntry(previous, (entry) => ({ ...entry, id: event.messageId }))
            this.proposals.update((list) =>
              list.map((item) =>
                item.entryId === previous ? { ...item, entryId: event.messageId } : item
              )
            )
            this.conversation.update((current) =>
              current ? { ...current, title: event.title, updatedAt: this.clock() } : current
            )
            this.answered.set(this.entryText(answerId))
            break
          }
          case 'error':
            this.failure.set(
              new ApiFailure({
                kind: 'http',
                status: null,
                code: event.code,
                message: event.message,
              })
            )
            break
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        this.stopped.set(true)
      } else {
        this.failure.set(toApiFailure(error))
      }
    }
    this.updateEntry(answerId, (entry) => ({ ...entry, streaming: false }))
    // An answer that never got a word nor a proposal leaves no empty row behind.
    if (!this.entryText(answerId) && !this.proposals().some((item) => item.entryId === answerId)) {
      this.entries.update((entries) => entries.filter((entry) => entry.id !== answerId))
    }
    this.finish(controller)
    await this.persist()
    // What is left of the month's allowance changed.
    void this.session.refresh().catch(() => undefined)
    return 'sent'
  }

  /** Stops the answer being written; what arrived stays. */
  stop(): void {
    this.controller?.abort()
  }

  async accept(tripId: string, actionId: string): Promise<void> {
    await this.decide(actionId, async () => {
      const { action } = await this.api.accept(tripId, actionId)
      this.replaceAction(action)
      // The change was written on the server: bring it to every screen.
      this.sync.requestSync()
    })
  }

  async reject(tripId: string, actionId: string): Promise<void> {
    await this.decide(actionId, async () => {
      this.replaceAction(await this.api.reject(tripId, actionId))
    })
  }

  private async decide(actionId: string, work: () => Promise<void>): Promise<void> {
    if (this.deciding().has(actionId)) return
    this.deciding.update((ids) => new Set([...ids, actionId]))
    this.decisionFailures.update((failures) => {
      const next = new Map(failures)
      next.delete(actionId)
      return next
    })
    try {
      await work()
    } catch (error) {
      const failure = toApiFailure(error)
      const action = this.proposals().find((item) => item.action.id === actionId)?.action
      if (action && failure.is('E_AI_ACTION_STALE')) {
        this.replaceAction({ ...action, status: 'failed', errorCode: 'E_AI_ACTION_STALE' })
      } else if (
        action &&
        failure.is('E_AI_ACTION_CLOSED') &&
        isStatus(failure.details['status'])
      ) {
        this.replaceAction({ ...action, status: failure.details['status'] })
      } else {
        this.decisionFailures.update((failures) => new Map(failures).set(actionId, failure))
      }
    } finally {
      this.deciding.update((ids) => new Set([...ids].filter((id) => id !== actionId)))
    }
    await this.persist()
  }

  private show(conversation: AiConversation, messages: AiMessage[], actions: AiAction[]): void {
    const { id, tripId, title, createdAt, updatedAt } = conversation
    this.conversation.set({ id, tripId, title, createdAt, updatedAt })
    const entries = messages
      .filter(
        (message) => message.content !== '' || actions.some((a) => a.messageId === message.id)
      )
      .map((message): ChatEntry => ({
        id: message.id,
        author: message.role === 'user' ? 'member' : 'assistant',
        text: message.content,
        createdAt: message.createdAt,
        streaming: false,
      }))
    const ids = new Set(entries.map((entry) => entry.id))
    this.entries.set(entries)
    this.proposals.set(
      actions.map((action) => ({
        action,
        entryId: action.messageId && ids.has(action.messageId) ? action.messageId : null,
      }))
    )
  }

  private replaceAction(action: AiAction): void {
    this.proposals.update((list) =>
      list.map((item) => (item.action.id === action.id ? { ...item, action } : item))
    )
  }

  private updateEntry(id: string, change: (entry: ChatEntry) => ChatEntry): void {
    this.entries.update((entries) =>
      entries.map((entry) => (entry.id === id ? change(entry) : entry))
    )
  }

  private entryText(id: string): string {
    return this.entries().find((entry) => entry.id === id)?.text ?? ''
  }

  private finish(controller: AbortController): void {
    if (this.controller === controller) this.controller = null
    this.phase.set('idle')
  }

  /** The conversation as it stands, on the device. */
  private async persist(): Promise<void> {
    const conversation = this.conversation()
    if (!conversation) return
    const messages: AiMessage[] = this.entries().map((entry) => ({
      id: entry.id,
      conversationId: conversation.id,
      role: entry.author === 'member' ? 'user' : 'assistant',
      content: entry.text,
      createdAt: entry.createdAt,
    }))
    const detail: AiConversationDetail = {
      ...conversation,
      messages,
      actions: this.proposals().map((item) => ({
        ...item.action,
        messageId: item.entryId ?? item.action.messageId,
      })),
    }
    try {
      await this.history.save(detail)
    } catch {
      // The device copy is a convenience: the server keeps the conversation.
    }
  }
}

function isStatus(value: unknown): value is AiActionStatus {
  return AI_ACTION_STATUSES.includes(value as AiActionStatus)
}
