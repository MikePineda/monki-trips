import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconButtonComponent } from '../icon-button/icon-button.component'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'

/**
 * One phrase shown full screen to someone who does not read the
 * traveller's language (a taxi driver, a waiter): the local phrase in very
 * large, high-contrast type, its romanization, and the traveller's own
 * wording small underneath. Every text is plain interpolation, never HTML.
 * Covers the whole viewport (tab bar and button included); the close
 * button or Escape emits `closed`. Keeping the screen on is the caller's
 * job; `screenKeptOn` only says so on the card.
 */
@Component({
  selector: 'mk-show-card',
  imports: [TranslocoPipe, MkIconButtonComponent, MkIconComponent],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-show-card',
    'role': 'dialog',
    'aria-modal': 'true',
    '[attr.aria-label]': 'prompt()',
    'tabindex': '-1',
    '(keydown.escape)': 'closed.emit()',
  },
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: flex;
      flex-direction: column;
      padding: calc(var(--space-3) + env(safe-area-inset-top)) var(--space-4)
        calc(var(--space-4) + env(safe-area-inset-bottom));
      background: var(--surface-0);
      color: var(--ink-1);
      overflow-y: auto;
      outline: none;
    }
    .mk-show-card__bar {
      display: flex;
      justify-content: flex-end;
    }
    .mk-show-card__body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--space-3);
      max-width: var(--container-max);
      width: 100%;
      margin: 0 auto;
    }
    .mk-show-card__phrase {
      margin: 0;
      font-size: clamp(2.25rem, 10vw, 4.5rem);
      line-height: 1.25;
      font-weight: 700;
      overflow-wrap: anywhere;
      white-space: pre-line;
    }
    .mk-show-card__romanization {
      margin: 0;
      font-size: clamp(1.25rem, 5vw, 2rem);
      line-height: 1.3;
      color: var(--ink-1);
      overflow-wrap: anywhere;
    }
    .mk-show-card__prompt,
    .mk-show-card__note,
    .mk-show-card__kept {
      margin: 0;
      color: var(--ink-2);
      overflow-wrap: anywhere;
    }
    .mk-show-card__kept {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--ink-3);
    }
  `,
  template: `
    <div class="mk-show-card__bar">
      <button
        mk-icon-button
        type="button"
        [attr.aria-label]="'ui.showCard.close' | transloco"
        data-testid="ui.showCard.close"
        (click)="closed.emit()"
      >
        <mk-icon name="x" />
      </button>
    </div>
    <div class="mk-show-card__body">
      <p class="mk-show-card__phrase" [attr.lang]="lang()" data-testid="ui.showCard.phrase">
        {{ phrase() }}
      </p>
      @if (romanization(); as romanization) {
        <p class="mk-show-card__romanization" data-testid="ui.showCard.romanization">
          {{ romanization }}
        </p>
      }
      <p class="mk-show-card__prompt mk-type-heading" data-testid="ui.showCard.prompt">
        {{ prompt() }}
      </p>
      @if (note(); as note) {
        <p class="mk-show-card__note mk-type-body">{{ note }}</p>
      }
      @if (screenKeptOn()) {
        <p class="mk-show-card__kept mk-type-caption" data-testid="ui.showCard.keptOn">
          <mk-icon name="sun" [size]="16" />
          {{ 'ui.showCard.keptOn' | transloco }}
        </p>
      }
    </div>
  `,
})
export class MkShowCardComponent {
  /** The phrase in the local language and script. */
  readonly phrase = input.required<string>()
  /** Its BCP 47 tag, so the browser shapes the script right. */
  readonly lang = input<string | null>(null)
  readonly romanization = input<string | null>(null)
  /** What it says in the traveller's language; also the dialog's name. */
  readonly prompt = input.required<string>()
  readonly note = input<string | null>(null)
  readonly screenKeptOn = input(false)
  readonly closed = output<void>()

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef)
    afterNextRender(() => host.nativeElement.focus())
  }
}
