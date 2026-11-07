import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/**
 * The scrolling body of a screen: one centred column (max `--container-max`),
 * the 16 px gutter plus the safe areas, and room for the tab bar and the
 * FAB when `tabBar` is set. Children space themselves with mk-stack and
 * mk-section; full-width children (mk-banner) read `--page-gutter` to bleed.
 */
@Component({
  selector: 'mk-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-page', '[attr.data-tab-bar]': 'tabBar() ? "" : null' },
  styles: `
    :host {
      --page-gutter: var(--space-2);
      display: block;
      box-sizing: border-box;
      width: 100%;
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-2) calc(var(--page-gutter) + env(safe-area-inset-right, 0px))
        calc(var(--space-3) + env(safe-area-inset-bottom, 0px))
        calc(var(--page-gutter) + env(safe-area-inset-left, 0px));
    }
    :host([data-tab-bar]) {
      padding-bottom: calc(
        var(--tab-bar-height) + var(--space-6) + var(--space-3) + env(safe-area-inset-bottom, 0px)
      );
    }
  `,
  template: `<ng-content />`,
})
export class MkPageComponent {
  readonly tabBar = input(false)
}
