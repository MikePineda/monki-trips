import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { provideUiI18n } from '../ui-i18n'
import { stampArtworkUrl, stampRotation } from './stamp-artwork'

/**
 * A passport stamp, the reward on the trip list: 112 px, two rings in
 * `stamp-ink`, the place name in mono caps, a short code and the date,
 * tilted a few degrees (stable per place). With artwork under
 * `public/stamps/<code>.svg` the drawing is painted through a CSS mask in
 * `stamp-ink`; otherwise the rings are generated inline. A place not reached
 * yet is a dashed ink-3 ring that says "Not yet". Never on Today, money or
 * charts.
 */
@Component({
  selector: 'mk-stamp',
  imports: [TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-stamp',
    'role': 'img',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.data-code]': 'code()',
    '[attr.data-reached]': 'reached() ? "" : null',
    '[attr.data-artwork]': 'artwork() ? code() : null',
    '[style.--mk-stamp-rotation.deg]': 'rotation()',
    '[style.--mk-stamp-artwork]': 'artwork() ? "url(" + artwork() + ")" : null',
  },
  styles: `
    :host {
      position: relative;
      display: inline-block;
      width: 112px;
      height: 112px;
      flex: none;
      color: var(--stamp-ink);
      transform: rotate(var(--mk-stamp-rotation));
    }
    :host(:not([data-reached])) {
      color: var(--ink-3);
    }
    .mk-stamp__artwork,
    .mk-stamp__rings {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .mk-stamp__artwork {
      background: currentColor;
      mask: var(--mk-stamp-artwork) center / contain no-repeat;
    }
    .mk-stamp__text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      gap: 1px;
      padding-bottom: 18px;
      box-sizing: border-box;
      text-align: center;
      text-transform: uppercase;
      pointer-events: none;
    }
    .mk-stamp__name {
      max-width: 84px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .mk-stamp__meta {
      letter-spacing: 0.08em;
    }
  `,
  template: `
    @if (artwork()) {
      <span class="mk-stamp__artwork" aria-hidden="true"></span>
    } @else {
      <svg class="mk-stamp__rings" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
        <circle
          cx="56"
          cy="56"
          r="54"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          [attr.stroke-dasharray]="reached() ? null : '6 5'"
        />
        <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" stroke-width="1" />
      </svg>
    }
    <span class="mk-stamp__text" aria-hidden="true">
      <span class="mk-stamp__name mk-type-code-label">{{ name() }}</span>
      <span class="mk-stamp__meta mk-type-eyebrow">
        @if (reached()) {
          {{ code() }}
          @if (date(); as date) {
            · {{ date }}
          }
        } @else {
          {{ 'ui.stamp.notYet' | transloco }}
        }
      </span>
    </span>
  `,
})
export class MkStampComponent {
  readonly code = input.required<string>()
  readonly name = input.required<string>()
  /** Already formatted, day first. */
  readonly date = input<string>()
  readonly reached = input(true)
  /** Accessible name; defaults to the place name. */
  readonly label = input<string>()

  protected readonly artwork = computed(() =>
    this.reached() ? stampArtworkUrl(this.code()) : undefined
  )
  protected readonly rotation = computed(() => stampRotation(this.code()))
  protected readonly ariaLabel = computed(() => this.label() ?? this.name())
}
