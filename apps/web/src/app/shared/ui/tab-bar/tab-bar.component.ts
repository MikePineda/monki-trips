import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'

export interface TabItem {
  id: string
  /** Already translated. */
  label: string
  icon: IconName
  link: string | readonly string[]
}

/**
 * The bottom tab bar of the trip shell: one link per tab, the active one
 * marked with `aria-current="page"`. Fixed to the bottom with the safe
 * area; exposes its height as `--mk-tab-bar-height` for toasts and FABs.
 */
@Component({
  selector: 'mk-tab-bar',
  imports: [RouterLink, RouterLinkActive, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-tab-bar' },
  styles: `
    :host {
      position: fixed;
      inset-inline: 0;
      bottom: 0;
      z-index: 40;
      display: block;
      border-top: 1px solid var(--line);
      background: var(--surface-1);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    nav {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      max-width: 40rem;
      margin: 0 auto;
      height: var(--mk-tab-bar-height, 3.5rem);
    }
    .mk-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.125rem;
      color: var(--ink-3);
      font-size: 0.6875rem;
      font-weight: 500;
      text-decoration: none;
    }
    .mk-tab--active {
      color: var(--accent);
    }
  `,
  template: `
    <nav [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.id) {
        <a
          class="mk-tab"
          [routerLink]="tab.link"
          routerLinkActive="mk-tab--active"
          ariaCurrentWhenActive="page"
          [attr.data-testid]="'shell.tab.' + tab.id"
        >
          <mk-icon [name]="tab.icon" />
          <span>{{ tab.label }}</span>
        </a>
      }
    </nav>
  `,
})
export class MkTabBarComponent {
  readonly tabs = input.required<readonly TabItem[]>()
  readonly label = input.required<string>()
}
