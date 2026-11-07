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
  /** Forces the active look (mock screens); the router decides otherwise. */
  active?: boolean
}

/** fixed: the real shell. static: in flow (the style guide's mock screens). */
export type TabBarPlacement = 'fixed' | 'static'

/**
 * The bottom tab bar of the trip shell: five links, 56 px plus the bottom
 * safe area on `surface-0` with a `line` hairline on top; a 24 px icon over
 * a 12 px label, inactive in ink-3, the active one in accent at 600 with
 * `aria-current="page"`. No badges: pending work shows in the connection
 * status.
 */
@Component({
  selector: 'mk-tab-bar',
  imports: [RouterLink, RouterLinkActive, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-tab-bar', '[attr.data-placement]': 'placement()' },
  styles: `
    :host {
      display: block;
      border-top: 1px solid var(--line);
      background: var(--surface-0);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    :host([data-placement='fixed']) {
      position: fixed;
      inset-inline: 0;
      bottom: 0;
      z-index: 40;
    }
    nav {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      max-width: var(--container-max);
      margin: 0 auto;
      height: var(--tab-bar-height);
    }
    .mk-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--ink-3);
      font-weight: 500;
      text-decoration: none;
    }
    .mk-tab--active {
      color: var(--accent);
      font-weight: 600;
    }
  `,
  template: `
    <nav [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.id) {
        <a
          class="mk-tab mk-type-caption"
          [routerLink]="tab.link"
          routerLinkActive="mk-tab--active"
          ariaCurrentWhenActive="page"
          [class.mk-tab--active]="tab.active"
          [attr.aria-current]="tab.active ? 'page' : null"
          [attr.data-testid]="'shell.tab.' + tab.id"
        >
          <mk-icon [name]="tab.icon" [size]="24" />
          <span>{{ tab.label }}</span>
        </a>
      }
    </nav>
  `,
})
export class MkTabBarComponent {
  readonly tabs = input.required<readonly TabItem[]>()
  readonly label = input.required<string>()
  readonly placement = input<TabBarPlacement>('fixed')
}
