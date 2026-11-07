import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'
import { MkMascotComponent, type MascotSize } from '../mascot/mascot.component'
import type { MascotState } from '../mascot/mascot-sheet'

/** centred: the whole screen. compact: inside a list (an empty day), illustration at the left. */
export type EmptyStateLayout = 'centred' | 'compact'

/**
 * An honest empty state: Kiko `md` in the fitting state (`mascot`), or a
 * 24 px icon in a 48 px `surface-2` square (radius 12); a heading title,
 * one sentence in ink-2 and room for exactly one action (`[mkEmptyAction]`).
 * No fake data, no spinner when there is simply nothing yet.
 */
@Component({
  selector: 'mk-empty-state',
  imports: [MkIconComponent, MkMascotComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-empty-state', '[attr.data-layout]': 'layout()' },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-4) var(--space-2);
      text-align: center;
      color: var(--ink-2);
    }
    :host([data-layout='compact']) {
      flex-direction: row;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) 0;
      text-align: start;
    }
    .mk-empty-state__text {
      display: flex;
      flex-direction: column;
      align-items: inherit;
      gap: var(--space-half);
      min-width: 0;
    }
    .mk-empty-state__square {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--space-6);
      height: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--surface-2);
      color: var(--icon);
    }
    .mk-empty-state__title {
      margin: 0;
      color: var(--ink-1);
    }
    .mk-empty-state__body {
      margin: 0;
      max-width: 28rem;
    }
    .mk-empty-state__action {
      margin-top: var(--space-1);
    }
    .mk-empty-state__action:empty {
      display: none;
    }
  `,
  template: `
    <div class="mk-empty-state__illustration">
      <ng-content select="[mkEmptyIcon]">
        @if (mascot(); as mascot) {
          <mk-mascot [state]="mascot" [size]="mascotSize()" />
        } @else if (icon(); as icon) {
          <span class="mk-empty-state__square"><mk-icon [name]="icon" [size]="24" /></span>
        }
      </ng-content>
    </div>
    <div class="mk-empty-state__text">
      <h2 class="mk-empty-state__title mk-type-heading">{{ title() }}</h2>
      @if (body(); as body) {
        <p class="mk-empty-state__body mk-type-body">{{ body }}</p>
      }
      <div class="mk-empty-state__action">
        <ng-content select="[mkEmptyAction]" />
      </div>
    </div>
  `,
})
export class MkEmptyStateComponent {
  readonly title = input.required<string>()
  readonly body = input<string>()
  readonly icon = input<IconName>()
  readonly mascot = input<MascotState>()
  /** `md` on a whole screen; `sm` for an empty section inside one (Today, a list). */
  readonly mascotSize = input<MascotSize>('md')
  readonly layout = input<EmptyStateLayout>('centred')
}
