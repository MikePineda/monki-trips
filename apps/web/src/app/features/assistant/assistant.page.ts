import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core'
import { NgTemplateOutlet } from '@angular/common'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  type AiAction,
  type LlmQuotaExceededPayload,
} from '@monkitrips/shared'
import { toApiFailure } from '../../core/api/api-failure'
import { failureMessage, type FailureMessage } from '../../core/api/failure-message'
import { intlLocale } from '../../core/i18n/intl-locale'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { OnlineStore } from '../../core/offline/online.store'
import { tripAiConversations } from '../../core/offline/trip-queries'
import { SessionStore } from '../../core/session/session.store'
import { formatDayDate } from '../../domain/day-date'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChatMessageComponent } from '../../shared/ui/chat/chat-message.component'
import { MkComposerComponent } from '../../shared/ui/chat/composer.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkMascotComponent } from '../../shared/ui/mascot/mascot.component'
import { MkProposalComponent } from '../../shared/ui/proposal/proposal.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { AssistantChatStore } from './assistant-chat.store'
import { AssistantHistoryStore } from './assistant-history.store'
import { provideAssistantI18n } from './assistant-i18n'
import { proposalStatus, proposalView, type ProposalView } from './proposal-view'

/** Codes the catalogue explains; anything else is `unknown` (with the server's words). */
const KNOWN_CODES = [
  'E_LLM_QUOTA_EXCEEDED',
  'E_TOO_MANY_REQUESTS',
  'E_LLM_UNAVAILABLE',
  'E_ROW_NOT_FOUND',
]

/** The suggestions of an empty chat, in the catalogue's order. */
export const ASSISTANT_SUGGESTIONS = ['tomorrow', 'perDay', 'expense', 'move'] as const

interface ProposalCard {
  action: AiAction
  view: ProposalView
  status: ReturnType<typeof proposalStatus>
  saving: boolean
  note: string | null
}

/**
 * `more/assistant[/:conversationId]`: Kiko, the trip assistant. Without
 * an id it is a new chat: suggestions and the member's earlier chats
 * (newest first, read from the device). A conversation shows its turns
 * as hairline rows, the answer as it streams (always plain text, never
 * HTML), Kiko thinking while there is nothing new to show, and each
 * proposal as a boarding pass to accept or reject. The chat needs a
 * connection: offline the history stays readable and the composer is
 * off. The first message creates the conversation and the URL follows
 * it. A finished answer is announced once (polite); the focus goes back
 * to the composer after send, stop and done.
 */
@Component({
  selector: 'app-assistant-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    MkBannerComponent,
    MkButtonComponent,
    MkChatMessageComponent,
    MkComposerComponent,
    MkEmptyStateComponent,
    MkFieldComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkInputDirective,
    MkListComponent,
    MkListRowComponent,
    MkMascotComponent,
    MkProposalComponent,
    MkRowComponent,
    MkSectionComponent,
    MkStackComponent,
    MkTextComponent,
  ],
  providers: [provideAssistantI18n(), AssistantChatStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3" data-testid="assistant">
      <mk-row gap="1" justify="between">
        <h1 mk-text variant="title" data-testid="assistant.title">
          {{ 'assistant.title' | transloco }}
        </h1>
        @if (chat.conversation(); as conversation) {
          <mk-row gap="half">
            <button
              mk-icon-button
              type="button"
              [disabled]="!online() || chat.busy()"
              [attr.aria-label]="
                'assistant.history.delete' | transloco: { title: titleOf(conversation.title) }
              "
              data-testid="assistant.delete"
              (click)="deleteConversation()"
            >
              <mk-icon name="trash-2" />
            </button>
            <a
              mk-button
              variant="secondary"
              size="sm"
              [routerLink]="['/t', tripId(), 'more', 'assistant']"
              data-testid="assistant.newChat"
            >
              <mk-icon name="plus" [size]="16" />
              {{ 'assistant.newChat' | transloco }}
            </a>
          </mk-row>
        }
      </mk-row>

      @if (!online()) {
        <mk-banner
          icon="wifi-off"
          [title]="'assistant.offline.title' | transloco"
          [body]="'assistant.offline.body' | transloco"
          data-testid="assistant.offline"
        />
      }

      @if (fresh()) {
        <mk-empty-state
          mascot="happy"
          mascotSize="sm"
          layout="compact"
          [title]="'assistant.title' | transloco"
          [body]="'assistant.intro' | transloco"
          data-testid="assistant.intro"
        />
        <mk-section [eyebrow]="'assistant.suggestions.title' | transloco">
          <mk-stack gap="1" align="start">
            @for (suggestion of suggestions; track suggestion) {
              <button
                mk-button
                variant="secondary"
                size="sm"
                type="button"
                [wrap]="true"
                [disabled]="!online()"
                data-testid="assistant.suggestion"
                (click)="useSuggestion('assistant.suggestions.' + suggestion)"
              >
                {{ 'assistant.suggestions.' + suggestion | transloco }}
              </button>
            }
          </mk-stack>
        </mk-section>
        @if (history().length > 0) {
          <mk-section [eyebrow]="'assistant.history.title' | transloco">
            <mk-list data-testid="assistant.history">
              @for (item of history(); track item.id) {
                <mk-list-row
                  icon="message-circle"
                  [title]="titleOf(item.title)"
                  [meta]="dayOf(item.updatedAt)"
                  [link]="['/t', tripId(), 'more', 'assistant', item.id]"
                  testId="assistant.history.row"
                />
              }
            </mk-list>
          </mk-section>
        }
      } @else {
        <mk-list [attr.aria-label]="'assistant.log' | transloco" data-testid="assistant.log">
          @for (entry of chat.entries(); track entry.id) {
            <mk-chat-message
              [author]="entry.author"
              [name]="(entry.author === 'member' ? 'assistant.you' : 'assistant.kiko') | transloco"
              [busy]="entry.streaming"
              data-testid="assistant.message"
              [attr.data-author]="entry.author"
            >
              @if (entry.text) {
                <p mk-text [preserveLines]="true" data-testid="assistant.message.text">
                  {{ entry.text }}
                </p>
              }
              @for (card of cardsFor(entry.id); track card.action.id) {
                <ng-container *ngTemplateOutlet="proposal; context: { $implicit: card }" />
              }
            </mk-chat-message>
          }
        </mk-list>
        @for (card of orphanCards(); track card.action.id) {
          <ng-container *ngTemplateOutlet="proposal; context: { $implicit: card }" />
        }
      }

      @if (thinking()) {
        <mk-row gap="1" data-testid="assistant.thinking">
          <mk-mascot state="thinking" size="sm" />
          <p mk-text tone="ink-2">{{ 'assistant.thinking' | transloco }}</p>
        </mk-row>
      }
      @if (chat.stopped()) {
        <p mk-text variant="caption" tone="ink-3" data-testid="assistant.stopped">
          {{ 'assistant.stopped' | transloco }}
        </p>
      }
      @if (error(); as error) {
        <mk-banner
          tone="serious"
          role="alert"
          icon="alert-triangle"
          [title]="error.fallback || (error.key | transloco: error.params)"
          [attr.data-code]="error.code"
          data-testid="assistant.error"
        />
      }

      <div aria-live="polite" class="mk-sr-only" data-testid="assistant.announcer">
        @if (chat.answered(); as answered) {
          {{ 'assistant.answered' | transloco: { text: answered } }}
        }
      </div>

      <mk-composer data-testid="assistant.composer">
        <mk-field [label]="'assistant.composer.label' | transloco">
          <textarea
            #composer
            mkInput
            rows="1"
            [attr.maxlength]="maxLength"
            [value]="draft()"
            [disabled]="!online()"
            data-testid="assistant.composer.input"
            (input)="draft.set($any($event.target).value)"
          ></textarea>
        </mk-field>
        @if (chat.busy()) {
          <button
            mk-button
            variant="secondary"
            type="button"
            data-testid="assistant.stop"
            (click)="stop()"
          >
            <mk-icon name="square" [size]="16" />
            {{ 'assistant.composer.stop' | transloco }}
          </button>
        } @else {
          <button
            mk-button
            type="button"
            [disabled]="!canSend()"
            data-testid="assistant.send"
            (click)="send()"
          >
            <mk-icon name="send" [size]="16" />
            {{ 'assistant.composer.send' | transloco }}
          </button>
        }
        @if (tokensLeft(); as tokensLeft) {
          <p
            mkComposerNote
            mk-text
            variant="caption"
            tone="ink-3"
            data-testid="assistant.tokensLeft"
          >
            {{ 'assistant.composer.tokensLeft' | transloco: { count: tokensLeft } }}
          </p>
        }
      </mk-composer>
    </mk-stack>

    <ng-template #proposal let-card>
      <mk-proposal
        [kind]="card.view.kind"
        [icon]="card.view.icon"
        [title]="card.view.title"
        [summary]="card.view.summary"
        [changes]="card.view.changes"
        [status]="card.status"
        [headingLevel]="2"
        data-testid="assistant.proposal"
        [attr.data-status]="card.action.status"
      >
        @if (card.action.status === 'proposed') {
          <mk-row mkProposalActions gap="1" [wrap]="true">
            <button
              mk-button
              size="sm"
              type="button"
              [loading]="card.saving"
              [disabled]="!online()"
              data-testid="assistant.proposal.accept"
              (click)="accept(card.action.id)"
            >
              <mk-icon name="check" [size]="16" />
              {{ 'assistant.proposal.accept' | transloco }}
            </button>
            <button
              mk-button
              variant="secondary"
              size="sm"
              type="button"
              [disabled]="!online() || card.saving"
              data-testid="assistant.proposal.reject"
              (click)="reject(card.action.id)"
            >
              <mk-icon name="x" [size]="16" />
              {{ 'assistant.proposal.reject' | transloco }}
            </button>
          </mk-row>
        }
        @if (card.note; as note) {
          <p mkProposalNote mk-text tone="ink-2" data-testid="assistant.proposal.note">
            {{ note }}
          </p>
        }
      </mk-proposal>
    </ng-template>
  `,
})
export default class AssistantPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()
  /** Bound from the route; absent on a new chat. */
  readonly conversationId = input<string>()

  protected readonly chat = inject(AssistantChatStore)
  private readonly historyStore = inject(AssistantHistoryStore)
  private readonly session = inject(SessionStore)
  private readonly router = inject(Router)
  private readonly sheets = inject(SheetService)
  private readonly transloco = inject(TranslocoService)
  private readonly locale = intlLocale()
  protected readonly online = inject(OnlineStore).online
  protected readonly history = tripAiConversations(this.tripId)
  private readonly catalogueReady = scopedLabels('assistant', ['title'])
  private readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer')

  protected readonly suggestions = ASSISTANT_SUGGESTIONS
  protected readonly maxLength = ASSISTANT_MESSAGE_MAX_LENGTH
  protected readonly draft = signal('')

  /** A new chat with nothing said yet: suggestions and earlier chats. */
  protected readonly fresh = computed(
    () => this.chat.conversation() === null && this.chat.entries().length === 0
  )
  protected readonly thinking = computed(() => this.chat.phase() === 'thinking')
  protected readonly canSend = computed(
    () => this.online() && !this.chat.busy() && this.draft().trim().length > 0
  )

  protected readonly tokensLeft = computed(() => {
    const left = this.session.user()?.llmTokensLeft
    return typeof left === 'number' ? new Intl.NumberFormat(this.locale()).format(left) : null
  })

  private readonly cards = computed(() => {
    const translate = (key: string, params?: Record<string, string | number>) =>
      this.transloco.translate(`assistant.${key}`, params ?? {})
    // Re-read when the language changes and once its catalogue has loaded.
    this.catalogueReady()
    const deciding = this.chat.deciding()
    const failures = this.chat.decisionFailures()
    return this.chat.proposals().map((item) => ({
      entryId: item.entryId,
      card: {
        action: item.action,
        view: proposalView(item.action, translate, this.locale()),
        status: proposalStatus(item.action, translate),
        saving: deciding.has(item.action.id),
        note: this.noteFor(item.action, failures.get(item.action.id)?.kind, translate),
      } satisfies ProposalCard,
    }))
  })

  protected readonly orphanCards = computed(() =>
    this.cards()
      .filter((item) => item.entryId === null)
      .map((item) => item.card)
  )

  protected readonly error = computed<(FailureMessage & { code: string }) | null>(() => {
    const failure = this.chat.failure()
    if (!failure) return null
    const message = failureMessage(failure, 'assistant', KNOWN_CODES)
    const code = failure.code ?? failure.kind
    if (failure.is('E_LLM_QUOTA_EXCEEDED')) {
      const { resetsOn } = failure.details as Partial<LlmQuotaExceededPayload>
      return {
        ...message,
        fallback: '',
        code,
        params: { date: resetsOn ? formatDayDate(resetsOn, this.locale(), false) : '' },
      }
    }
    const known = !message.key.endsWith('.unknown')
    return { ...message, fallback: known ? '' : message.fallback, code }
  })

  constructor() {
    // Open the conversation of the URL, unless it is the one this chat just created.
    effect(() => {
      const id = this.conversationId()
      const tripId = this.tripId()
      untracked(() => {
        if (id && id === this.chat.conversation()?.id) return
        if (id) {
          void this.chat.open(id, tripId)
        } else {
          this.chat.reset()
          if (this.online()) void this.historyStore.refresh(tripId).catch(() => undefined)
        }
      })
    })
    // The URL names the conversation once the first message created it.
    effect(() => {
      const id = this.chat.conversation()?.id
      untracked(() => {
        if (id && id !== this.conversationId()) {
          void this.router
            .navigate(['/t', this.tripId(), 'more', 'assistant', id], { replaceUrl: true })
            .catch(() => undefined)
        }
      })
    })
  }

  protected cardsFor(entryId: string): ProposalCard[] {
    return this.cards()
      .filter((item) => item.entryId === entryId)
      .map((item) => item.card)
  }

  protected titleOf(title: string | null): string {
    return title || this.transloco.translate('assistant.history.untitled')
  }

  protected dayOf(instant: string): string {
    return formatDayDate(instant.slice(0, 10), this.locale())
  }

  protected useSuggestion(key: string): void {
    this.draft.set(this.transloco.translate(key))
    void this.send()
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim()
    if (!text || !this.online() || this.chat.busy()) return
    this.draft.set('')
    const sending = this.chat.send(this.tripId(), text)
    this.focusComposer()
    const outcome = await sending
    if (outcome === 'refused' && this.draft() === '') {
      this.draft.set(text)
    }
    this.focusComposer()
  }

  protected stop(): void {
    this.chat.stop()
    this.focusComposer()
  }

  protected accept(actionId: string): void {
    void this.chat.accept(this.tripId(), actionId)
  }

  protected reject(actionId: string): void {
    void this.chat.reject(this.tripId(), actionId)
  }

  protected async deleteConversation(): Promise<void> {
    const conversation = this.chat.conversation()
    if (!conversation) return
    const confirmed = await this.sheets.confirm({
      title: this.transloco.translate('assistant.history.confirm.title'),
      body: this.transloco.translate('assistant.history.confirm.body'),
      confirmLabel: this.transloco.translate('assistant.history.confirm.action'),
    })
    if (!confirmed) return
    try {
      await this.historyStore.remove(this.tripId(), conversation.id)
    } catch (error) {
      this.chat.failure.set(toApiFailure(error))
      return
    }
    void this.router.navigate(['/t', this.tripId(), 'more', 'assistant']).catch(() => undefined)
  }

  /** The note under a proposal: why it failed, why it expired, or why the decision did not save. */
  private noteFor(
    action: AiAction,
    decisionFailure: 'http' | 'network' | undefined,
    t: (key: string) => string
  ): string | null {
    if (action.status === 'failed' && action.errorCode === 'E_AI_ACTION_STALE') {
      return t('proposal.stale')
    }
    if (action.status === 'expired') return t('proposal.expiredNote')
    if (decisionFailure === 'network') return t('proposal.network')
    if (decisionFailure === 'http') return t('proposal.unknown')
    return null
  }

  private focusComposer(): void {
    queueMicrotask(() => this.composer()?.nativeElement.focus())
  }
}
