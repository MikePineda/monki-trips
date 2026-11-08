import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import type { LlmQuotaExceededPayload } from '@monkitrips/shared'
import { ApiFailure, toApiFailure } from '../../core/api/api-failure'
import { failureMessage, type FailureMessage } from '../../core/api/failure-message'
import { LangStore } from '../../core/i18n/lang.store'
import { intlLocale } from '../../core/i18n/intl-locale'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { OnlineStore } from '../../core/offline/online.store'
import { SyncService } from '../../core/offline/sync.service'
import { tripPhraseCards, tripStops } from '../../core/offline/trip-queries'
import { formatDayDate } from '../../domain/day-date'
import { groupPhraseCards } from '../../domain/phrase-card-groups'
import { PHRASE_CARD_LANGUAGES, destinationLanguage } from '../../domain/phrase-card-languages'
import { fillName, hasNamePlaceholder } from '../../domain/phrase-card-name'
import { translateUrl } from '../../domain/translate-link'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { cardName } from './card-name'
import { PhraseCardsStore } from './phrase-cards.store'
import { PhraseNameStore } from './phrase-name.store'
import { providePhrasesI18n } from './phrases-i18n'

/**
 * The full-screen card ships in this page's chunk (the route loads it from
 * here): once the list has opened, a card opens with no request at all,
 * even before the service worker has cached every script.
 */
export { default as PhraseShowPage } from './phrase-show.page'

/** Food preference chips, sent to the model in the traveller's words (their label). */
export const FOOD_PREFERENCES = [
  'vegetarian',
  'vegan',
  'no_pork',
  'no_beef',
  'no_seafood',
  'no_peanuts',
  'gluten_free',
  'not_spicy',
] as const

type FoodPreference = (typeof FOOD_PREFERENCES)[number]

/** Codes the catalogue explains; anything else is `unknown`. */
const KNOWN_CODES = [
  'E_LLM_QUOTA_EXCEEDED',
  'E_TOO_MANY_REQUESTS',
  'E_CONFLICT',
  'E_LLM_UNAVAILABLE',
  'E_LLM_BAD_OUTPUT',
]

/** What one preference may hold on the wire. */
const PREFERENCE_MAX_LENGTH = 80

/**
 * `more/phrases`: cards in the local language. The language picker
 * preselects the destination's language (from the stops). A set made
 * before the trip is read from the device, so the list works offline;
 * making one (or making it again, behind a confirm) needs a connection
 * and shows Kiko thinking while the model writes. A card opens full
 * screen (`show/:cardKey`, the child route). Every card text is plain
 * interpolation; `{name}` is filled on the device with the picked name.
 */
@Component({
  selector: 'app-phrases-page',
  imports: [
    RouterOutlet,
    TranslocoPipe,
    MkBannerComponent,
    MkButtonComponent,
    MkChipComponent,
    MkEmptyStateComponent,
    MkFieldComponent,
    MkInputDirective,
    MkIconComponent,
    MkListComponent,
    MkListRowComponent,
    MkRowComponent,
    MkSectionComponent,
    MkStackComponent,
    MkTextComponent,
  ],
  providers: [providePhrasesI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3" data-testid="phrases">
      <mk-stack gap="1">
        <h1 mk-text variant="title">{{ 'phrases.title' | transloco }}</h1>
        <p mk-text tone="ink-2">{{ 'phrases.intro' | transloco }}</p>
      </mk-stack>

      <mk-field [label]="'phrases.language' | transloco">
        <select
          mkInput
          data-testid="phrases.language"
          (change)="pickLanguage($any($event.target).value)"
        >
          @for (option of languageOptions(); track option.tag) {
            <option [value]="option.tag" [selected]="option.tag === language()">
              {{ option.label }}
            </option>
          }
        </select>
      </mk-field>

      @if (generating()) {
        <mk-empty-state
          mascot="thinking"
          [title]="'phrases.generating' | transloco"
          data-testid="phrases.generating"
        />
      } @else if (set(); as set) {
        @if (needsName()) {
          <mk-section [eyebrow]="'phrases.name.label' | transloco">
            <mk-stack gap="1">
              <mk-row gap="1" [wrap]="true" data-testid="phrases.name">
                @for (choice of names.choices(); track choice) {
                  <mk-chip
                    [selectable]="true"
                    [selected]="choice === names.name()"
                    (selectedChange)="pickName(choice)"
                    data-testid="phrases.name.choice"
                  >
                    {{ choice }}
                  </mk-chip>
                }
              </mk-row>
              <p mk-text variant="caption" tone="ink-3">{{ 'phrases.name.hint' | transloco }}</p>
            </mk-stack>
          </mk-section>
        }
        @for (group of groups(); track group.category) {
          <mk-section
            [eyebrow]="'phrases.category.' + group.category | transloco"
            [attr.data-category]="group.category"
          >
            <mk-list>
              @for (item of group.cards; track item.key) {
                <mk-list-row
                  [title]="item.prompt"
                  [meta]="item.phrase"
                  [link]="['show', item.key]"
                  [chevron]="true"
                  testId="phrases.card"
                />
              }
            </mk-list>
          </mk-section>
        }
        <mk-stack gap="half">
          <a
            mk-button
            variant="secondary"
            size="block"
            target="_blank"
            rel="noopener"
            [href]="translateHref()"
            data-testid="phrases.translate"
          >
            <mk-icon name="languages" [size]="18" />
            {{ 'phrases.translate' | transloco }}
          </a>
          <p mk-text variant="caption" tone="ink-3">{{ 'phrases.translateHint' | transloco }}</p>
        </mk-stack>
      } @else {
        <mk-empty-state
          mascot="asleep"
          mascotSize="sm"
          [title]="'phrases.empty.title' | transloco: { language: languageName() }"
          [body]="'phrases.empty.body' | transloco"
          data-testid="phrases.empty"
        />
      }

      @if (error(); as error) {
        <mk-banner
          tone="serious"
          role="alert"
          icon="alert-triangle"
          [title]="error.fallback || (error.key | transloco: error.params)"
          [attr.data-code]="error.code"
          data-testid="phrases.error"
        />
      }

      <mk-section [eyebrow]="'phrases.food.title' | transloco">
        <mk-stack gap="1">
          <mk-row gap="1" [wrap]="true" data-testid="phrases.food">
            @for (option of foodOptions; track option) {
              <mk-chip
                [selectable]="true"
                [selected]="food().has(option)"
                (selectedChange)="toggleFood(option, $event)"
                data-testid="phrases.food.option"
                [attr.data-option]="option"
              >
                {{ 'phrases.food.options.' + option | transloco }}
              </mk-chip>
            }
          </mk-row>
          <mk-field
            [label]="'phrases.food.note' | transloco"
            [hint]="'phrases.food.hint' | transloco"
          >
            <input
              mkInput
              type="text"
              [attr.maxlength]="noteMax"
              [value]="note()"
              (input)="note.set($any($event.target).value)"
              data-testid="phrases.food.note"
            />
          </mk-field>
        </mk-stack>
      </mk-section>

      @if (!online()) {
        <mk-banner
          icon="wifi-off"
          [title]="'phrases.offline' | transloco"
          data-testid="phrases.offline"
        />
      }
      <button
        mk-button
        [variant]="set() ? 'secondary' : 'primary'"
        size="block"
        type="button"
        [disabled]="!online()"
        [loading]="generating()"
        data-testid="phrases.generate"
        (click)="generate()"
      >
        {{ (set() ? 'phrases.regenerate' : 'phrases.generate') | transloco }}
      </button>
    </mk-stack>
    <router-outlet />
  `,
})
export default class PhrasesPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly store = inject(PhraseCardsStore)
  private readonly nameStore = inject(PhraseNameStore)
  private readonly sheets = inject(SheetService)
  private readonly transloco = inject(TranslocoService)
  private readonly sync = inject(SyncService)
  private readonly lang = inject(LangStore).lang
  private readonly locale = intlLocale()
  protected readonly online = inject(OnlineStore).online
  private readonly sets = tripPhraseCards(this.tripId)
  private readonly stops = tripStops(this.tripId)
  private readonly foodLabels = scopedLabels(
    'phrases',
    FOOD_PREFERENCES.map((option) => `food.options.${option}`)
  )

  protected readonly names = cardName(this.tripId)
  protected readonly foodOptions = FOOD_PREFERENCES
  protected readonly noteMax = PREFERENCE_MAX_LENGTH
  protected readonly food = signal<ReadonlySet<FoodPreference>>(new Set())
  protected readonly note = signal('')
  protected readonly generating = signal(false)
  private readonly failure = signal<ApiFailure | null>(null)
  private readonly chosenLanguage = signal<string | null>(null)

  /** The picked language, else the destination's, else the first supported one. */
  protected readonly language = computed(
    () =>
      this.chosenLanguage() ??
      destinationLanguage(this.stops(), this.lang()) ??
      PHRASE_CARD_LANGUAGES[0] ??
      'en'
  )

  private readonly displayNames = computed(() => {
    try {
      return new Intl.DisplayNames([this.locale()], { type: 'language' })
    } catch {
      return null
    }
  })

  protected readonly languageOptions = computed(() => {
    const names = this.displayNames()
    return PHRASE_CARD_LANGUAGES.map((tag) => ({ tag, label: names?.of(tag) ?? tag })).sort(
      (a, b) => a.label.localeCompare(b.label, this.locale())
    )
  })

  protected readonly languageName = computed(
    () => this.displayNames()?.of(this.language()) ?? this.language()
  )

  protected readonly set = computed(
    () => this.sets().find((candidate) => candidate.language === this.language()) ?? null
  )

  protected readonly needsName = computed(
    () =>
      this.set()?.cards.some(
        (card) => hasNamePlaceholder(card.prompt) || hasNamePlaceholder(card.phrase)
      ) ?? false
  )

  /** The set's cards by category, `{name}` filled with the picked name. */
  protected readonly groups = computed(() => {
    const set = this.set()
    const name = this.names.name()
    return set
      ? groupPhraseCards(set.id, set.cards).map((group) => ({
          category: group.category,
          cards: group.cards.map(({ key, card }) => ({
            key,
            prompt: fillName(card.prompt, name),
            phrase: fillName(card.phrase, name),
          })),
        }))
      : []
  })

  protected readonly translateHref = computed(() => translateUrl(this.lang(), this.language()))

  protected readonly error = computed<(FailureMessage & { code: string }) | null>(() => {
    const failure = this.failure()
    if (!failure) {
      return null
    }
    const message = failureMessage(failure, 'phrases', KNOWN_CODES)
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
    // A known code reads from the catalogue; the server's words only stand in for an unknown one.
    const known = !message.key.endsWith('.unknown')
    return { ...message, fallback: known ? '' : message.fallback, code }
  })

  protected pickLanguage(tag: string): void {
    this.chosenLanguage.set(tag)
    this.failure.set(null)
  }

  protected pickName(name: string): void {
    void this.nameStore.pick(this.tripId(), name)
  }

  protected toggleFood(option: FoodPreference, selected: boolean): void {
    const next = new Set(this.food())
    if (selected) {
      next.add(option)
    } else {
      next.delete(option)
    }
    this.food.set(next)
  }

  protected async generate(): Promise<void> {
    if (this.generating() || !this.online()) {
      return
    }
    const force = this.set() !== null
    if (force && !(await this.confirmReplace())) {
      return
    }
    this.failure.set(null)
    this.generating.set(true)
    try {
      await this.store.generate({
        tripId: this.tripId(),
        language: this.language(),
        preferences: this.preferences(),
        force,
      })
    } catch (error) {
      const failure = toApiFailure(error)
      this.failure.set(failure)
      if (failure.is('E_CONFLICT')) {
        // The set exists on the server already: the pull brings it.
        this.sync.requestSync()
      }
    } finally {
      this.generating.set(false)
    }
  }

  private preferences(): string[] {
    const labels = this.foodLabels()
    const chosen = FOOD_PREFERENCES.flatMap((option, index) =>
      this.food().has(option) && labels[index] ? [labels[index]] : []
    )
    const note = this.note().trim().slice(0, PREFERENCE_MAX_LENGTH)
    return note ? [...chosen, note] : chosen
  }

  private confirmReplace(): Promise<boolean> {
    const language = this.languageName()
    return this.sheets.confirm({
      title: this.transloco.translate('phrases.confirm.title'),
      body: this.transloco.translate('phrases.confirm.body', { language }),
      confirmLabel: this.transloco.translate('phrases.confirm.action'),
    })
  }
}
