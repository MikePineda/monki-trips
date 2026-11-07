import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

/** The type scale of DESIGN.md (`.mk-type-*` in src/styles.css). */
export const TEXT_VARIANTS = [
  'display',
  'title',
  'heading',
  'body',
  'body-strong',
  'label',
  'caption',
  'code-display',
  'code',
  'code-label',
  'eyebrow',
] as const

export type TextVariant = (typeof TEXT_VARIANTS)[number]

/** Where the text may take its colour from: ink steps, the accent (links) or a status (with an icon). */
export type TextTone =
  | 'inherit'
  | 'ink-1'
  | 'ink-2'
  | 'ink-3'
  | 'accent'
  | 'offline'
  | 'stamp-ink'
  | 'status-good'
  | 'status-warning'
  | 'status-serious'
  | 'status-critical'

export type TextAlign = 'start' | 'center' | 'end'

/**
 * Typography for features: `<h1 mk-text variant="title">`, `<p mk-text
 * variant="caption" tone="ink-2">`. Applied to the semantic element so the
 * heading level stays the author's; the look comes from the type scale and
 * the ink tokens only. Numbers keep tabular figures through the scale.
 */
@Component({
  selector: '[mk-text]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.data-tone]': 'tone()',
    '[attr.data-align]': 'align()',
    '[attr.data-truncate]': 'truncate() ? "" : null',
    '[attr.data-break]': 'breakAnywhere() ? "" : null',
  },
  styles: `
    :host {
      display: block;
      margin: 0;
      min-width: 0;
      color: var(--ink-1);
    }
    :host([data-tone='inherit']) {
      color: inherit;
    }
    :host([data-tone='ink-2']) {
      color: var(--ink-2);
    }
    :host([data-tone='ink-3']) {
      color: var(--ink-3);
    }
    :host([data-tone='accent']) {
      color: var(--accent);
    }
    :host([data-tone='offline']) {
      color: var(--offline);
    }
    :host([data-tone='stamp-ink']) {
      color: var(--stamp-ink);
    }
    :host([data-tone='status-good']) {
      color: var(--status-good);
    }
    :host([data-tone='status-warning']) {
      color: var(--status-warning);
    }
    :host([data-tone='status-serious']) {
      color: var(--status-serious);
    }
    :host([data-tone='status-critical']) {
      color: var(--status-critical);
    }
    :host([data-align='center']) {
      text-align: center;
    }
    :host([data-align='end']) {
      text-align: end;
    }
    :host([data-truncate]) {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    :host([data-break]) {
      overflow-wrap: anywhere;
    }
    :host(span),
    :host(a),
    :host(code),
    :host(time) {
      display: inline-block;
    }
  `,
  template: `<ng-content />`,
})
export class MkTextComponent {
  readonly variant = input<TextVariant>('body')
  readonly tone = input<TextTone>('ink-1')
  readonly align = input<TextAlign>('start')
  readonly truncate = input(false)
  /** Long unbroken values (a link, a token) wrap at any character instead of overflowing. */
  readonly breakAnywhere = input(false)

  protected readonly classes = computed(() => `mk-text mk-type-${this.variant()}`)
}
