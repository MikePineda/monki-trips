import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/**
 * A section of a screen, separated from the previous one by a `line`
 * hairline and 8 px of padding, never boxed. An optional departures-board
 * eyebrow ("NEXT", "TONIGHT") in mono caps and ink-3, or a heading title.
 */
@Component({
  selector: 'mk-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-section', '[attr.data-hairline]': 'hairline() ? "" : null' },
  styles: `
    :host {
      display: block;
      padding: var(--space-1) 0;
    }
    :host([data-hairline]) {
      border-top: 1px solid var(--line);
    }
    :host(:first-child) {
      border-top: 0;
      padding-top: 0;
    }
    .mk-section__eyebrow {
      margin: 0 0 var(--space-half);
      color: var(--ink-3);
    }
    .mk-section__title {
      margin: 0 0 var(--space-1);
      color: var(--ink-1);
    }
  `,
  template: `
    @if (eyebrow(); as eyebrow) {
      <p class="mk-section__eyebrow mk-type-eyebrow">{{ eyebrow }}</p>
    }
    @if (title(); as title) {
      <h2 class="mk-section__title mk-type-heading">{{ title }}</h2>
    }
    <ng-content />
  `,
})
export class MkSectionComponent {
  readonly eyebrow = input<string>()
  readonly title = input<string>()
  readonly hairline = input(true)
}
