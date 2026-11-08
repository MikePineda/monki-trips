import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { provideUiI18n } from '../ui-i18n'
import { stampArtworkUrl, stampRotation } from './stamp-artwork'
import { STAMP_ICON_PATHS, stampDesign, type StampArrival } from './stamp-generator'

export type StampSize = 'sm' | 'md' | 'lg'

/** 64 / 112 / 160 px. */
const SIZE_PX: Record<StampSize, number> = { sm: 64, md: 112, lg: 160 }

let nextId = 0

/**
 * A passport stamp, the reward of the trip history and the passport. With
 * artwork under `public/stamps/<code>.svg` the drawing is painted through a
 * CSS mask in `stamp-ink` with the name, code and date below; otherwise the
 * stamp generator draws one from the place and its date: shape, double
 * ring, the place along the top, the date, the arrival icon, a stable tilt,
 * one of the four `stamp-ink-*` inks and an ink texture (an SVG filter, no
 * colour). A place not reached yet is drawn faded: `ink-3`, a dashed ring,
 * no texture and "Not yet" (or `pendingLabel`). `animate` stamps it in once
 * (never under reduced motion). Never on Today, money or charts.
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
    '[attr.data-state]': 'reached() ? "earned" : "upcoming"',
    '[attr.data-artwork]': 'artwork() ? code() : null',
    '[attr.data-shape]': 'artwork() ? null : design().shape',
    '[attr.data-icon]': 'artwork() ? null : design().icon',
    '[attr.data-size]': 'size()',
    '[attr.data-animate]': 'animate() ? "" : null',
    '[style.--mk-stamp-size.px]': 'px()',
    '[style.--mk-stamp-rotation.deg]': 'rotation()',
    '[style.--mk-stamp-ink]': 'artwork() ? null : design().inkVar',
    '[style.--mk-stamp-artwork]': 'artwork() ? "url(" + artwork() + ")" : null',
  },
  styles: `
    :host {
      position: relative;
      display: inline-block;
      width: var(--mk-stamp-size);
      height: var(--mk-stamp-size);
      flex: none;
      color: var(--mk-stamp-ink, var(--stamp-ink));
      transform: rotate(var(--mk-stamp-rotation));
    }
    :host(:not([data-reached])) {
      color: var(--ink-3);
    }
    :host([data-animate]) {
      animation: mk-stamp-in 520ms var(--ease-out) both;
    }
    @keyframes mk-stamp-in {
      0% {
        opacity: 0;
        transform: rotate(calc(var(--mk-stamp-rotation) - 14deg)) scale(1.7);
      }
      60% {
        opacity: 1;
        transform: rotate(var(--mk-stamp-rotation)) scale(0.94);
      }
      100% {
        transform: rotate(var(--mk-stamp-rotation)) scale(1);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([data-animate]) {
        animation: none;
      }
    }
    .mk-stamp__artwork,
    .mk-stamp__drawing {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .mk-stamp__artwork {
      background: currentColor;
      mask: var(--mk-stamp-artwork) center / contain no-repeat;
    }
    .mk-stamp__drawing text {
      font-family: var(--font-mono);
      font-weight: 600;
      fill: currentColor;
      text-anchor: middle;
    }
    .mk-stamp__place {
      font-size: 10px;
      letter-spacing: 0.08em;
    }
    .mk-stamp__date {
      font-size: 11px;
      letter-spacing: 0.06em;
      font-variant-numeric: tabular-nums;
    }
    .mk-stamp__code {
      font-size: 8px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .mk-stamp__text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      gap: 1px;
      padding-bottom: 14px;
      box-sizing: border-box;
      text-align: center;
      text-transform: uppercase;
      pointer-events: none;
    }
    :host([data-size='sm']) .mk-stamp__text {
      display: none;
    }
    .mk-stamp__name {
      max-width: 90px;
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
      <span class="mk-stamp__text" aria-hidden="true">
        <span class="mk-stamp__name mk-type-code-label">{{ name() }}</span>
        <span class="mk-stamp__meta mk-type-eyebrow">
          {{ code() }}
          @if (date(); as date) {
            · {{ date }}
          }
        </span>
      </span>
    } @else {
      @let d = design();
      <svg
        class="mk-stamp__drawing"
        [attr.viewBox]="d.viewBox"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          @if (reached()) {
            <filter [attr.id]="ids.filter" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence
                type="fractalNoise"
                [attr.baseFrequency]="d.texture.frequency"
                numOctaves="2"
                [attr.seed]="d.texture.seed"
                result="grain"
              />
              <feColorMatrix
                in="grain"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.45"
                result="speckle"
              />
              <feComposite in="SourceGraphic" in2="speckle" operator="in" result="inked" />
              <feDisplacementMap in="inked" in2="grain" scale="1.2" />
            </filter>
          }
          @if (d.textArc) {
            <path [attr.id]="ids.arc" [attr.d]="d.textArc" fill="none" />
          }
        </defs>
        <g [attr.filter]="reached() ? 'url(#' + ids.filter + ')' : null">
          <path
            class="mk-stamp__ring"
            [attr.d]="d.outline"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            [attr.stroke-dasharray]="reached() ? null : '6 5'"
          />
          <path
            class="mk-stamp__ring"
            [attr.d]="d.inner"
            fill="none"
            stroke="currentColor"
            stroke-width="1.25"
            [attr.stroke-dasharray]="d.innerDotted ? '1 2.5' : null"
            stroke-linecap="round"
          />
          @if (d.textArc) {
            <text class="mk-stamp__place">
              <textPath
                [attr.href]="'#' + ids.arc"
                startOffset="50%"
                [attr.textLength]="d.placeFit"
                [attr.lengthAdjust]="d.placeFit ? 'spacingAndGlyphs' : null"
              >
                {{ d.placeText }}
              </textPath>
            </text>
          } @else {
            <text
              class="mk-stamp__place"
              x="60"
              [attr.y]="d.placeY"
              [attr.textLength]="d.placeFit"
              [attr.lengthAdjust]="d.placeFit ? 'spacingAndGlyphs' : null"
            >
              {{ d.placeText }}
            </text>
          }
          <path
            [attr.d]="iconPath()"
            [attr.transform]="'translate(' + d.iconX + ' ' + d.iconY + ')'"
            fill="currentColor"
            fill-rule="evenodd"
          />
          @for (star of d.stars; track $index) {
            <circle [attr.cx]="star.x" [attr.cy]="star.y" r="1.6" fill="currentColor" />
          }
          <text class="mk-stamp__date" x="60" [attr.y]="d.dateY">{{ d.dateText }}</text>
          <text class="mk-stamp__code" x="60" [attr.y]="d.codeY">
            @if (reached()) {
              {{ d.codeText }}
            } @else {
              {{ pendingLabel() ?? ('ui.stamp.notYet' | transloco) }}
            }
          </text>
        </g>
      </svg>
    }
  `,
})
export class MkStampComponent {
  readonly code = input.required<string>()
  readonly name = input.required<string>()
  /** Already formatted, day first: printed on artwork stamps, and instead of `isoDate` on generated ones. */
  readonly date = input<string>()
  /** `YYYY-MM-DD` of the visit: seeds the generated stamp and prints as `DD.MM.YYYY`. */
  readonly isoDate = input<string | null>()
  readonly arrivedBy = input<StampArrival | null>()
  readonly reached = input(true)
  /** What a stamp not reached yet says instead of its code; defaults to "Not yet". */
  readonly pendingLabel = input<string>()
  readonly size = input<StampSize>('md')
  /** Stamp in once on first render (a newly earned stamp). */
  readonly animate = input(false)
  /** Accessible name; defaults to the place name. */
  readonly label = input<string>()

  protected readonly ids = { filter: `mk-stamp-ink-${++nextId}`, arc: `mk-stamp-arc-${nextId}` }

  protected readonly artwork = computed(() =>
    this.reached() ? stampArtworkUrl(this.code()) : undefined
  )
  protected readonly design = computed(() =>
    stampDesign({
      place: this.name(),
      date: this.isoDate(),
      label: this.isoDate() ? null : this.date(),
      code: this.code(),
      arrivedBy: this.arrivedBy(),
    })
  )
  protected readonly iconPath = computed(() => STAMP_ICON_PATHS[this.design().icon])
  protected readonly rotation = computed(() =>
    this.artwork() ? stampRotation(this.code()) : this.design().rotation
  )
  protected readonly px = computed(() => SIZE_PX[this.size()])
  protected readonly ariaLabel = computed(() => this.label() ?? this.name())
}
