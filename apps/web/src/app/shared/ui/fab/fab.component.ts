import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/** fixed: floats 16 px above the tab bar at the right. static: in flow (the style guide). */
export type FabPlacement = 'fixed' | 'static'

/**
 * The quick-expense button: accent fill, `accent-ink` label, 48 px, radius
 * 12, level-1 elevation; the one floating control on a trip screen. Native
 * `<button mk-fab>` or `<a mk-fab>` with the icon and label as content.
 */
@Component({
  selector: 'button[mk-fab], a[mk-fab]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-fab mk-type-body-strong', '[attr.data-placement]': 'placement()' },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: var(--space-6);
      padding: 0 var(--space-2) 0 12px;
      border: 0;
      border-radius: var(--radius-lg);
      background: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      box-shadow: var(--elevation-1);
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    :host([data-placement='fixed']) {
      position: fixed;
      right: calc(var(--space-2) + env(safe-area-inset-right, 0px));
      bottom: calc(var(--tab-bar-height) + var(--space-2) + env(safe-area-inset-bottom, 0px));
      z-index: 45;
    }
  `,
  template: `<ng-content />`,
})
export class MkFabComponent {
  readonly placement = input<FabPlacement>('fixed')
}
