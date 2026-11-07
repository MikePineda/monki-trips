import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  input,
  signal,
} from '@angular/core'
import { ACTIVE_MASCOT, mascotSheetUrl, type MascotSheet, type MascotState } from './mascot-sheet'

export type MascotSize = 'sm' | 'md' | 'lg'

/** 48 / 96 / 160 px. */
const SIZE_PX: Record<MascotSize, number> = { sm: 48, md: 96, lg: 160 }

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * `<mk-mascot [state] size="sm|md|lg" [label]>`: the active mascot
 * (`public/mascot/active.json`) animated from its sprite sheet with a CSS
 * `steps()` animation driven by custom properties. `aria-hidden` without a
 * label, `role="img"` with one. Under `prefers-reduced-motion` (or
 * `motion="still"`) only the state's `still` frame shows. The mascot never
 * sits on data: Today header, empty states, loading and onboarding only.
 */
@Component({
  selector: 'mk-mascot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-mascot',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.data-state]': 'state()',
    '[attr.data-size]': 'size()',
    '[attr.data-motion]': 'still() ? "still" : "animated"',
    '[style.--mk-mascot-size.px]': 'px()',
    '[style.--mk-mascot-sheet]': 'image()',
    '[style.--mk-mascot-cols]': 'columns()',
    '[style.--mk-mascot-rows]': 'rows()',
    '[style.--mk-mascot-frames]': 'frames().length',
    '[style.--mk-mascot-x]': 'startX()',
    '[style.--mk-mascot-end-x]': 'endX()',
    '[style.--mk-mascot-still-x]': 'stillX()',
    '[style.--mk-mascot-y]': 'y()',
    '[style.--mk-mascot-duration]': 'duration()',
    '[style.--mk-mascot-render]': 'sheet.render === "pixelated" ? "pixelated" : "auto"',
  },
  styles: `
    :host {
      display: inline-block;
      width: var(--mk-mascot-size);
      height: var(--mk-mascot-size);
      flex: none;
      background-image: var(--mk-mascot-sheet);
      background-repeat: no-repeat;
      background-size: calc(var(--mk-mascot-cols) * var(--mk-mascot-size))
        calc(var(--mk-mascot-rows) * var(--mk-mascot-size));
      background-position: var(--mk-mascot-x) var(--mk-mascot-y);
      image-rendering: var(--mk-mascot-render);
      animation: mk-mascot-run var(--mk-mascot-duration) steps(var(--mk-mascot-frames)) infinite;
    }
    :host([data-motion='still']) {
      animation: none;
      background-position: var(--mk-mascot-still-x) var(--mk-mascot-y);
    }
    @keyframes mk-mascot-run {
      from {
        background-position-x: var(--mk-mascot-x);
      }
      to {
        background-position-x: var(--mk-mascot-end-x);
      }
    }
  `,
  template: ``,
})
export class MkMascotComponent {
  readonly state = input.required<MascotState>()
  readonly size = input<MascotSize>('md')
  readonly label = input<string>()
  /** `still` forces the still frame (the style guide's toggle); `auto` follows the device. */
  readonly motion = input<'auto' | 'still'>('auto')

  protected readonly sheet: MascotSheet = ACTIVE_MASCOT

  private readonly document = inject(DOCUMENT)
  private readonly reducedMotion = signal(false)

  protected readonly px = computed(() => SIZE_PX[this.size()])
  protected readonly image = computed(() => `url("${mascotSheetUrl(this.sheet)}")`)
  protected readonly frames = computed(() => this.sheet.states[this.state()].frames)
  protected readonly columns = computed(() =>
    Math.max(...Object.values(this.sheet.states).flatMap((s) => s.frames.map(([col]) => col + 1)))
  )
  protected readonly rows = computed(() =>
    Math.max(...Object.values(this.sheet.states).flatMap((s) => s.frames.map(([, row]) => row + 1)))
  )
  protected readonly still = computed(() => this.motion() === 'still' || this.reducedMotion())
  protected readonly startX = computed(() => `${-this.frames()[0][0] * this.px()}px`)
  protected readonly endX = computed(
    () => `${-(this.frames()[0][0] + this.frames().length) * this.px()}px`
  )
  protected readonly stillX = computed(() => {
    const frame = this.frames()[this.sheet.states[this.state()].still] ?? this.frames()[0]
    return `${-frame[0] * this.px()}px`
  })
  protected readonly y = computed(() => `${-this.frames()[0][1] * this.px()}px`)
  protected readonly duration = computed(
    () => `${this.frames().length / this.sheet.states[this.state()].fps}s`
  )

  constructor() {
    const media = this.document.defaultView?.matchMedia?.(REDUCED_MOTION)
    if (media) {
      this.reducedMotion.set(media.matches)
      media.addEventListener?.('change', (event) => this.reducedMotion.set(event.matches))
    }
  }
}
