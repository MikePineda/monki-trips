import { NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'

/**
 * An itinerary row: a 64 px mono time column (local time in `code`, the
 * zone abbreviation below in ink-3 when it differs from the device), an
 * optional icon, the title, a meta line and room for one action at the end
 * (`[mkRowAction]`, usually the "Directions" link). Lodging rows pass the
 * `bed-double` icon and "Night 1 of 2" as meta. With `link` the time, icon
 * and text become one navigation target (the event detail); the action
 * stays its own target. `tone` dims a cancelled event or an idea.
 */
@Component({
  selector: 'mk-event-row',
  imports: [NgTemplateOutlet, RouterLink, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-event-row', 'role': 'listitem', '[attr.data-tone]': 'tone()' },
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: var(--space-1);
      min-height: var(--space-6);
      padding: var(--space-1) 0;
      box-sizing: border-box;
    }
    :host(:not(:last-child)) {
      border-bottom: 1px solid var(--line);
    }
    .mk-event__time {
      flex: none;
      width: var(--space-8);
      color: var(--ink-1);
    }
    .mk-event__zone {
      display: block;
      color: var(--ink-3);
    }
    .mk-event__icon {
      color: var(--icon);
      margin-top: 2px;
    }
    .mk-event__text {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-width: 0;
    }
    .mk-event__title {
      margin: 0;
      color: var(--ink-1);
    }
    .mk-event__meta {
      margin: 0;
      color: var(--ink-3);
    }
    .mk-event__action {
      flex: none;
      align-self: center;
    }
    .mk-event__link {
      display: flex;
      flex: 1 1 0;
      align-items: flex-start;
      gap: var(--space-1);
      min-width: 0;
      color: inherit;
      text-decoration: none;
    }
    :host([data-tone='muted']) .mk-event__title,
    :host([data-tone='muted']) .mk-event__time {
      color: var(--ink-3);
      text-decoration: line-through;
    }
    .mk-event__badge {
      display: block;
      color: var(--ink-3);
    }
  `,
  template: `
    <ng-template #body>
      <span class="mk-event__time mk-type-code">
        <time>{{ time() }}</time>
        @if (zone(); as zone) {
          <span class="mk-event__zone mk-type-caption">{{ zone }}</span>
        }
      </span>
      @if (icon(); as icon) {
        <mk-icon class="mk-event__icon" [name]="icon" />
      }
      <span class="mk-event__text">
        <span class="mk-event__title mk-type-body-strong">{{ title() }}</span>
        @if (meta(); as meta) {
          <span class="mk-event__meta mk-type-caption">{{ meta }}</span>
        }
        @if (badge(); as badge) {
          <span class="mk-event__badge mk-type-caption">{{ badge }}</span>
        }
      </span>
    </ng-template>
    @if (link(); as link) {
      <a class="mk-event__link" [routerLink]="link" [attr.data-testid]="testId()">
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <ng-container *ngTemplateOutlet="body" />
    }
    <span class="mk-event__action"><ng-content select="[mkRowAction]" /></span>
  `,
})
export class MkEventRowComponent {
  /** Local time of the place, `HH:mm`; "all day" rows pass the translated word. */
  readonly time = input.required<string>()
  readonly zone = input<string>()
  readonly title = input.required<string>()
  readonly meta = input<string>()
  readonly icon = input<IconName>()
  /** A second caption line: the sync state ("Pending") or a status word. */
  readonly badge = input<string>()
  /** `muted` for a cancelled event or a mere idea. */
  readonly tone = input<'default' | 'muted'>('default')
  readonly link = input<string | readonly string[]>()
  /** `data-testid` of the row's link. */
  readonly testId = input<string>()
}
