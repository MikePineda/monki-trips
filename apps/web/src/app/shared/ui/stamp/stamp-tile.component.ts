import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import type { StampArrival } from './stamp-generator'
import { MkStampComponent, type StampSize } from './stamp.component'

/**
 * A stamp you can tap, with its caption: the passport's page of a country
 * and its cities. A real `<button>` (focus ring, 44 px or more) around an
 * `mk-stamp`; the caption below is the place in caps and a short line
 * (the date, or "Coming up"). `(pick)` says it was tapped; the page opens
 * the detail (when, on which trip).
 */
@Component({
  selector: 'mk-stamp-tile',
  imports: [MkStampComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-stamp-tile', '[attr.data-state]': 'reached() ? "earned" : "upcoming"' },
  styles: `
    :host {
      display: inline-block;
      min-width: 0;
    }
    button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-half);
      min-width: 88px;
      max-width: 168px;
      padding: var(--space-1);
      border: 0;
      border-radius: var(--radius-md);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: var(--surface-2);
    }
    button:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
    .mk-stamp-tile__caption,
    .mk-stamp-tile__meta {
      max-width: 100%;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      text-align: center;
    }
    .mk-stamp-tile__caption {
      color: var(--ink-1);
    }
    .mk-stamp-tile__meta {
      color: var(--ink-3);
    }
  `,
  template: `
    <button type="button" [attr.aria-label]="label() ?? caption()" (click)="pick.emit()">
      <mk-stamp
        [code]="code()"
        [name]="name()"
        [isoDate]="isoDate()"
        [arrivedBy]="arrivedBy()"
        [reached]="reached()"
        [pendingLabel]="pendingLabel()"
        [size]="size()"
        [animate]="animate()"
      />
      <span class="mk-stamp-tile__caption mk-type-code-label">{{ caption() }}</span>
      @if (meta(); as meta) {
        <span class="mk-stamp-tile__meta mk-type-caption">{{ meta }}</span>
      }
    </button>
  `,
})
export class MkStampTileComponent {
  readonly code = input.required<string>()
  /** The place printed on the stamp. */
  readonly name = input.required<string>()
  readonly isoDate = input<string | null>()
  readonly arrivedBy = input<StampArrival | null>()
  readonly reached = input(true)
  readonly pendingLabel = input<string>()
  readonly size = input<StampSize>('md')
  readonly animate = input(false)
  /** The line under the stamp: the place, as people read it. */
  readonly caption = input.required<string>()
  /** A second line: the date, or "Coming up". */
  readonly meta = input<string>()
  /** Accessible name of the button; defaults to the caption. */
  readonly label = input<string>()

  readonly pick = output<void>()
}
