import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MkIconButtonComponent } from '../icon-button/icon-button.component'
import { MkIconComponent } from '../icon/icon.component'

/**
 * The header of a screen: an optional back link (44 px), the title in
 * heading (truncated), an optional second line (the connection status,
 * `[mkTopBarStatus]`) and trailing actions (`[mkTopBarActions]`), on
 * `surface-0` over a `line` hairline, inside the top safe area.
 */
@Component({
  selector: 'mk-top-bar',
  imports: [RouterLink, MkIconComponent, MkIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-top-bar' },
  styles: `
    :host {
      display: block;
      padding-top: env(safe-area-inset-top, 0px);
      border-bottom: 1px solid var(--line);
      background: var(--surface-0);
      color: var(--ink-1);
    }
    .mk-top-bar__inner {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      max-width: var(--container-max);
      min-height: var(--row-height);
      margin: 0 auto;
      padding: var(--space-half) var(--space-2);
      box-sizing: border-box;
    }
    .mk-top-bar__back {
      margin-left: calc(-1 * var(--space-1));
    }
    .mk-top-bar__text {
      flex: 1 1 0;
      min-width: 0;
    }
    .mk-top-bar__title {
      margin: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .mk-top-bar__actions {
      display: flex;
      align-items: center;
      gap: var(--space-half);
      margin-right: calc(-1 * var(--space-1));
    }
    .mk-top-bar__actions:empty {
      display: none;
    }
  `,
  template: `
    <div class="mk-top-bar__inner">
      @if (backLink(); as back) {
        <a
          mk-icon-button
          class="mk-top-bar__back"
          [routerLink]="back"
          [attr.aria-label]="backLabel()"
          data-testid="shell.back"
        >
          <mk-icon name="arrow-left" />
        </a>
      }
      <div class="mk-top-bar__text">
        <p class="mk-top-bar__title mk-type-heading" data-testid="shell.name">{{ title() }}</p>
        <ng-content select="[mkTopBarStatus]" />
      </div>
      <div class="mk-top-bar__actions"><ng-content select="[mkTopBarActions]" /></div>
    </div>
  `,
})
export class MkTopBarComponent {
  readonly title = input.required<string>()
  readonly backLink = input<string | readonly string[]>()
  /** Accessible name of the back link; required when `backLink` is set. */
  readonly backLabel = input<string>()
}
