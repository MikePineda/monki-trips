import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import { MkRouteChipComponent } from '../route-chip/route-chip.component'
import { provideUiI18n } from '../ui-i18n'

/**
 * The next event on Today: `surface-1` paper with a 1px `line-strong` edge,
 * radius 8 and a perforation (two 8 px notches cut by an SVG mask plus a
 * dashed hairline) at 108 of 172. Top: title, local time in code-display
 * (zone only when it differs), countdown and "Leave at". Stub: the route in
 * code-display, the booking reference and one action (`[mkTicketAction]`).
 * One ticket per screen; no gradient, no shadow, no accent on the paper.
 */
@Component({
  selector: 'mk-ticket',
  imports: [TranslocoPipe, MkIconComponent, MkRouteChipComponent],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-ticket' },
  styles: `
    :host {
      position: relative;
      display: block;
      aspect-ratio: 358 / 172;
      color: var(--ink-1);
    }
    .mk-ticket__paper {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .mk-ticket__body {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
    }
    .mk-ticket__top {
      flex: none;
      height: calc(100% * 108 / 172);
      box-sizing: border-box;
      padding: var(--space-1) var(--space-2) 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-half);
    }
    .mk-ticket__stub {
      flex: 1 1 0;
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: 0 var(--space-2);
      min-height: 0;
    }
    .mk-ticket__title {
      margin: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .mk-ticket__when {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
      flex-wrap: wrap;
    }
    .mk-ticket__zone {
      color: var(--ink-3);
    }
    .mk-ticket__countdown {
      color: var(--ink-2);
    }
    .mk-ticket__leave {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
    }
    .mk-ticket__route {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .mk-ticket__reference {
      color: var(--ink-2);
    }
    .mk-ticket__action {
      flex: none;
    }
  `,
  template: `
    <svg
      class="mk-ticket__paper"
      viewBox="0 0 358 172"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask [attr.id]="maskId" maskUnits="userSpaceOnUse" x="0" y="0" width="358" height="172">
          <rect width="358" height="172" fill="white" />
          <circle cx="0" cy="108" r="8" fill="black" />
          <circle cx="358" cy="108" r="8" fill="black" />
        </mask>
      </defs>
      <g [attr.mask]="'url(#' + maskId + ')'">
        <rect
          x="0.5"
          y="0.5"
          width="357"
          height="171"
          rx="8"
          fill="var(--surface-1)"
          stroke="var(--line-strong)"
        />
        <line
          x1="14"
          y1="108.5"
          x2="344"
          y2="108.5"
          stroke="var(--line-strong)"
          stroke-dasharray="4 4"
        />
      </g>
      <path
        d="M0 108.5a8 8 0 0 0 8-8M0 108.5a8 8 0 0 1 8 8M358 108.5a8 8 0 0 1-8-8M358 108.5a8 8 0 0 0-8 8"
        fill="none"
        stroke="var(--line-strong)"
      />
    </svg>
    <div class="mk-ticket__body">
      <div class="mk-ticket__top">
        @if (headingLevel() === 2) {
          <h2 class="mk-ticket__title mk-type-heading">{{ title() }}</h2>
        } @else {
          <h3 class="mk-ticket__title mk-type-heading">{{ title() }}</h3>
        }
        <div class="mk-ticket__when">
          <time class="mk-type-code-display" data-testid="ui.ticket.time">{{ time() }}</time>
          @if (zone(); as zone) {
            <span class="mk-ticket__zone mk-type-code-label">{{ zone }}</span>
          }
          @if (countdown(); as countdown) {
            <span class="mk-ticket__countdown mk-type-body">{{ countdown }}</span>
          }
        </div>
        @if (leaveAt(); as leaveAt) {
          <span class="mk-ticket__leave mk-type-body-strong" data-testid="ui.ticket.leave">
            <mk-icon name="clock" [size]="16" />
            {{ 'ui.ticket.leaveAt' | transloco: { time: leaveAt } }}
          </span>
        }
      </div>
      <div class="mk-ticket__stub">
        <div class="mk-ticket__route">
          <mk-route-chip [stops]="route()" size="display" />
          @if (reference(); as reference) {
            <span
              class="mk-ticket__reference mk-type-code-label"
              data-testid="ui.ticket.reference"
              >{{ reference }}</span
            >
          }
        </div>
        <div class="mk-ticket__action"><ng-content select="[mkTicketAction]" /></div>
      </div>
    </div>
  `,
})
export class MkTicketComponent {
  private static nextId = 0

  readonly title = input.required<string>()
  /** The title's heading level: 3 inside a titled section, 2 right under the page's h1 (Today). */
  readonly headingLevel = input<2 | 3>(3)
  /** Local time `HH:mm` of the place. */
  readonly time = input.required<string>()
  /** Zone abbreviation, only when it differs from the device. */
  readonly zone = input<string>()
  /** Already formatted: "in 1 h 32 min". */
  readonly countdown = input<string>()
  /** `HH:mm` to leave; the component adds "Leave at". */
  readonly leaveAt = input<string>()
  /** Codes of the route, `['PVM', 'ALD']`. */
  readonly route = input.required<readonly string[]>()
  readonly reference = input<string>()

  protected readonly maskId = `mk-ticket-perforation-${MkTicketComponent.nextId++}`
}
