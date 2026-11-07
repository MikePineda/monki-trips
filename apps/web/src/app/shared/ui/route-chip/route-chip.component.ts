import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/** label: the 28 px chip (code-label). display: the ticket stub (code-display, no border). */
export type RouteChipSize = 'label' | 'display'

/**
 * `PVM → ALD`, or a whole trip `PVM → ALD → KSB`: codes in mono, arrows in
 * ink-3. Route chips are data, so they never take the accent; the small
 * size has a `line-strong` hairline and radius 4 on a transparent fill.
 */
@Component({
  selector: 'mk-route-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-route-chip', '[attr.data-size]': 'size()' },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      color: var(--ink-1);
      white-space: pre;
    }
    :host([data-size='label']) {
      min-height: 28px;
      padding: 0 var(--space-1);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
      background: transparent;
    }
    .mk-route__arrow {
      color: var(--ink-3);
    }
  `,
  template: `
    @for (stop of stops(); track $index; let last = $last) {
      <span class="mk-route__code">{{ stop }}</span>
      @if (!last) {
        <span class="mk-route__arrow" aria-hidden="true">{{ ' → ' }}</span>
      }
    }
  `,
})
export class MkRouteChipComponent {
  readonly stops = input.required<readonly string[]>()
  readonly size = input<RouteChipSize>('label')
}
