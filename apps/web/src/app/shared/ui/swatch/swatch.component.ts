import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core'
import { contrastRatio, parseCssColor } from '../../../domain/contrast'

export interface SwatchContrast {
  against: string
  ratio: number
}

/**
 * One colour token of the design system for the style guide: the swatch,
 * `--name`, the value the browser resolves and the WCAG contrast ratio
 * against each surface token named in `against`, computed at runtime from
 * the live theme (so the dark values are checked when the theme flips).
 */
@Component({
  selector: 'mk-swatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-swatch', '[attr.data-token]': 'token()' },
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      min-height: var(--space-6);
      color: var(--ink-1);
    }
    .mk-swatch__chip {
      flex: none;
      width: var(--space-4);
      height: var(--space-4);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
    }
    .mk-swatch__text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .mk-swatch__name {
      color: var(--ink-1);
    }
    .mk-swatch__ratios {
      color: var(--ink-2);
    }
  `,
  template: `
    <span #chip class="mk-swatch__chip" [style.background-color]="'var(--' + token() + ')'"></span>
    <span class="mk-swatch__text">
      <code class="mk-swatch__name mk-type-code-label">--{{ token() }}</code>
      <span class="mk-swatch__ratios mk-type-caption" data-testid="styleguide.swatch.ratios">
        @for (item of ratios(); track item.against) {
          <span>{{ item.against }} {{ item.ratio.toFixed(2) }}:1 </span>
        }
      </span>
    </span>
  `,
})
export class MkSwatchComponent {
  readonly token = input.required<string>()
  /** Surface tokens to compute the contrast against (none for surfaces). */
  readonly against = input<readonly string[]>([])

  protected readonly ratios = signal<SwatchContrast[]>([])

  private readonly chip = viewChild.required<ElementRef<HTMLElement>>('chip')
  private readonly document = inject(DOCUMENT)

  constructor() {
    afterRenderEffect(() => {
      const view = this.document.defaultView
      if (!view) {
        return
      }
      const root = view.getComputedStyle(this.document.documentElement)
      const own = parseCssColor(view.getComputedStyle(this.chip().nativeElement).backgroundColor)
      const items: SwatchContrast[] = []
      for (const against of this.against()) {
        const surface = parseCssColor(root.getPropertyValue(`--${against}`))
        if (own && surface) {
          items.push({ against, ratio: contrastRatio(own, surface) })
        }
      }
      this.ratios.set(items)
    })
  }
}
