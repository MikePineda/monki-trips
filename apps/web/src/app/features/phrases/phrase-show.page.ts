import { Location } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
} from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { liveSignalFor } from '../../core/offline/live'
import type { PhraseCardRecord } from '../../core/offline/records'
import { ScreenWakeLock } from '../../core/pwa/screen-wake-lock'
import { cardByKey } from '../../domain/phrase-card-groups'
import { fillName } from '../../domain/phrase-card-name'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkShowCardComponent } from '../../shared/ui/show-card/show-card.component'
import { cardName } from './card-name'
import { providePhrasesI18n } from './phrases-i18n'

/**
 * `more/phrases/show/:cardKey`: one card full screen, read from the
 * device (works offline), `{name}` filled with the name picked on this
 * device, the screen kept on while it is open (Wake Lock, where the
 * browser has it). Closing goes back where the traveller came from (the
 * list, or Today's "Show to driver").
 */
@Component({
  selector: 'app-phrase-show-page',
  imports: [TranslocoPipe, MkButtonComponent, MkEmptyStateComponent, MkShowCardComponent],
  providers: [providePhrasesI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown(); as shown) {
      <mk-show-card
        [phrase]="shown.phrase"
        [lang]="shown.language"
        [romanization]="shown.romanization"
        [prompt]="shown.prompt"
        [note]="shown.note"
        [screenKeptOn]="keptOn"
        (closed)="close()"
        data-testid="phrases.show"
      />
    } @else if (sets() !== null) {
      <mk-empty-state
        mascot="worried"
        mascotSize="sm"
        [title]="'phrases.notFound' | transloco"
        data-testid="phrases.show.missing"
      >
        <button mk-button mkEmptyAction variant="secondary" type="button" (click)="close()">
          {{ 'phrases.title' | transloco }}
        </button>
      </mk-empty-state>
    }
  `,
})
export default class PhraseShowPage {
  readonly tripId = input.required<string>()
  readonly cardKey = input.required<string>()

  private readonly router = inject(Router)
  private readonly route = inject(ActivatedRoute)
  private readonly location = inject(Location)
  private readonly wakeLock = inject(ScreenWakeLock)
  private readonly name = cardName(this.tripId).name

  /** Null while the device copy loads, so a valid card never flashes "not found". */
  protected readonly sets = liveSignalFor<string, PhraseCardRecord[] | null>(
    this.tripId,
    (db, id) => db.phraseCards.where('tripId').equals(id).toArray(),
    null
  )

  protected readonly keptOn = this.wakeLock.supported

  protected readonly shown = computed(() => {
    const sets = this.sets() ?? []
    const card = cardByKey(sets, this.cardKey())
    if (!card) {
      return null
    }
    const setId = this.cardKey().slice(0, this.cardKey().lastIndexOf(':'))
    const name = this.name()
    return {
      language: sets.find((set) => set.id === setId)?.language ?? null,
      phrase: fillName(card.phrase, name),
      romanization: card.romanization === null ? null : fillName(card.romanization, name),
      prompt: fillName(card.prompt, name),
      note: card.note,
    }
  })

  constructor() {
    void this.wakeLock.hold()
    inject(DestroyRef).onDestroy(() => void this.wakeLock.release())
  }

  protected close(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back()
      return
    }
    void this.router.navigate(['../..'], { relativeTo: this.route })
  }
}
