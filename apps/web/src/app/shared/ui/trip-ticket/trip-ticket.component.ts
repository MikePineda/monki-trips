import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MkRouteChipComponent } from '../route-chip/route-chip.component'

/**
 * `<a mk-trip-ticket [routerLink] [title] [eyebrow] [route] [stats] [dates] [amount]>`:
 * one trip of the travel history as a ticket. The body carries the phase
 * line, the name, the route chips, days · nights · countries and the dates
 * with the total spent; a perforated edge (a dashed hairline between two
 * notches) separates the stub, where the trip's cover stamp goes
 * (`[mkTicketStamp]`). `surface-1` paper, `line-strong` edge, no accent:
 * the whole ticket is the link. Long names and routes end in an ellipsis,
 * so it fits a 360 px screen.
 */
@Component({
  selector: 'a[mk-trip-ticket]',
  imports: [MkRouteChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-trip-ticket' },
  styles: `
    :host {
      --mk-ticket-notch: 8px;
      position: relative;
      display: flex;
      min-width: 0;
      color: var(--ink-1);
      text-decoration: none;
      background: var(--surface-1);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      mask:
        radial-gradient(
            circle var(--mk-ticket-notch) at calc(100% - 88px) 0,
            transparent 98%,
            black 100%
          )
          top / 100% 51% no-repeat,
        radial-gradient(
            circle var(--mk-ticket-notch) at calc(100% - 88px) 100%,
            transparent 98%,
            black 100%
          )
          bottom / 100% 51% no-repeat;
    }
    :host(:focus-visible) {
      outline: none;
      box-shadow: var(--focus-ring);
    }
    :host(:hover) {
      border-color: var(--ink-3);
    }
    .mk-trip-ticket__body {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-half);
      padding: var(--space-1) var(--space-2) var(--space-1) var(--space-2);
    }
    .mk-trip-ticket__line {
      margin: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .mk-trip-ticket__eyebrow {
      color: var(--ink-3);
    }
    .mk-trip-ticket__title {
      color: var(--ink-1);
    }
    .mk-trip-ticket__route {
      color: var(--ink-1);
    }
    .mk-trip-ticket__stats,
    .mk-trip-ticket__dates {
      color: var(--ink-2);
    }
    .mk-trip-ticket__foot {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-1);
      min-width: 0;
    }
    .mk-trip-ticket__amount {
      flex: none;
      color: var(--ink-1);
      font-variant-numeric: tabular-nums;
    }
    .mk-trip-ticket__stub {
      flex: none;
      width: 88px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-left: 1px dashed var(--line-strong);
      margin: var(--mk-ticket-notch) 0;
    }
  `,
  template: `
    <span class="mk-trip-ticket__body">
      @if (eyebrow(); as eyebrow) {
        <span class="mk-trip-ticket__line mk-trip-ticket__eyebrow mk-type-eyebrow">
          {{ eyebrow }}
        </span>
      }
      <span class="mk-trip-ticket__line mk-trip-ticket__title mk-type-heading">{{ title() }}</span>
      @if (route().length > 0) {
        <span class="mk-trip-ticket__line mk-trip-ticket__route mk-type-code-label">
          <mk-route-chip [stops]="route()" size="display" />
        </span>
      }
      @if (stats(); as stats) {
        <span class="mk-trip-ticket__line mk-trip-ticket__stats mk-type-caption">{{ stats }}</span>
      }
      <span class="mk-trip-ticket__foot">
        <span class="mk-trip-ticket__line mk-trip-ticket__dates mk-type-code-label">
          {{ dates() }}
        </span>
        @if (amount(); as amount) {
          <span
            class="mk-trip-ticket__amount mk-type-code-label"
            data-testid="mk-trip-ticket.amount"
          >
            {{ amount }}
          </span>
        }
      </span>
    </span>
    <span class="mk-trip-ticket__stub">
      <ng-content select="[mkTicketStamp]" />
    </span>
  `,
})
export class MkTripTicketComponent {
  readonly title = input.required<string>()
  /** Where the trip stands: "In 82 days", "Day 3 of 18", "Back 5 days ago". */
  readonly eyebrow = input<string>()
  readonly route = input<readonly string[]>([])
  /** "10 days · 9 nights · 2 countries". */
  readonly stats = input<string>()
  readonly dates = input.required<string>()
  /** Total spent, formatted in the base currency. */
  readonly amount = input<string>()
}
