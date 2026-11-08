import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/**
 * One figure of up to three in a `<mk-stat-row>`, separated by vertical
 * `line` hairlines, never boxed: eyebrow, value in title (tabular),
 * sub-line in caption / ink-2 ("A$138", "of €300"). Values stay in ink; a
 * negative uses U+2212 and says what it means in the sub-line. The value
 * scales between 20 px and the title's 24 px with the row's width and is
 * never truncated; a tile too wide for the line moves to the next one.
 */
@Component({
  selector: 'mk-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-stat-tile' },
  styles: `
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 2px;
      box-sizing: border-box;
      max-width: 100%;
      margin-right: var(--space-2);
      padding: var(--space-1) var(--space-2) var(--space-1) 0;
      border-right: 1px solid var(--line);
      color: var(--ink-1);
    }
    @container (max-width: 240px) {
      :host {
        flex-basis: 100%;
      }
    }
    .mk-stat__eyebrow {
      margin: 0;
      color: var(--ink-3);
    }
    .mk-stat__value {
      margin: 0;
      font-size: clamp(20px, 6cqi, 24px);
      line-height: 1.3;
      font-variant-numeric: tabular-nums;
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
