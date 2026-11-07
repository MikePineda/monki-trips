import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/**
 * One figure of up to three in a row (`<mk-row align="stretch" gap="0">`),
 * separated by vertical `line` hairlines, never boxed: eyebrow, value in
 * title (tabular), sub-line in caption / ink-2 ("A$138", "of €300"). Values
 * stay in ink; a negative uses U+2212 and says what it means in the sub-line.
 */
@Component({
  selector: 'mk-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-stat-tile' },
  styles: `
    :host {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      padding: var(--space-1) var(--space-2) var(--space-1) 0;
      color: var(--ink-1);
    }
    :host(:not(:first-child)) {
      padding-left: var(--space-2);
      border-left: 1px solid var(--line);
    }
    .mk-stat__eyebrow {
      margin: 0;
      color: var(--ink-3);
    }
    .mk-stat__value {
      margin: 0;
      white-space: nowrap;
    }
    .mk-stat__sub {
      margin: 0;
      color: var(--ink-2);
    }
  `,
  template: `
    <p class="mk-stat__eyebrow mk-type-eyebrow">{{ eyebrow() }}</p>
    <p class="mk-stat__value mk-type-title">{{ value() }}</p>
    @if (sub(); as sub) {
      <p class="mk-stat__sub mk-type-caption">{{ sub }}</p>
    }
  `,
})
export class MkStatTileComponent {
  readonly eyebrow = input.required<string>()
  /** Already formatted (money through the money formatter). */
  readonly value = input.required<string>()
  readonly sub = input<string>()
}
