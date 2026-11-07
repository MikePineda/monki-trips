import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'

/**
 * An honest empty state: an illustration slot (`[mkEmptyIcon]`, where the
 * mascot goes in WP 0.7; falls back to a Lucide icon), a title, an optional
 * one-line body and room for exactly one action (`[mkEmptyAction]`).
 */
@Component({
  selector: 'mk-empty-state',
  imports: [MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-empty-state' },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      text-align: center;
      color: var(--ink-2);
    }
    .mk-empty-state__icon {
      color: var(--ink-3);
      margin-bottom: 0.25rem;
    }
    .mk-empty-state__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 500;
      color: var(--ink-1);
    }
    .mk-empty-state__body {
      margin: 0;
      font-size: 0.875rem;
      max-width: 28rem;
    }
    .mk-empty-state__action {
      margin-top: 0.75rem;
    }
    .mk-empty-state__action:empty {
      display: none;
    }
  `,
  template: `
    <div class="mk-empty-state__icon">
      <ng-content select="[mkEmptyIcon]">
        @if (icon(); as icon) {
          <mk-icon [name]="icon" [size]="40" />
        }
      </ng-content>
    </div>
    <h2 class="mk-empty-state__title">{{ title() }}</h2>
    @if (body(); as body) {
      <p class="mk-empty-state__body">{{ body }}</p>
    }
    <div class="mk-empty-state__action">
      <ng-content select="[mkEmptyAction]" />
    </div>
  `,
})
export class MkEmptyStateComponent {
  readonly title = input.required<string>()
  readonly body = input<string>()
  readonly icon = input<IconName>()
}
