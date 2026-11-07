import { ChangeDetectionStrategy, Component, input } from '@angular/core'

export type IconButtonSize = 'md' | 'sm'

/**
 * A square icon-only control on a native `<button>` or `<a>`: 44 px target
 * (`sm` draws 36 px and keeps an invisible 44 px hit area), ink-2 at rest,
 * no fill, the focus ring. The caller gives the `aria-label`; the icon is
 * the content: `<button mk-icon-button aria-label="Copy"><mk-icon name="copy" /></button>`.
 */
@Component({
  selector: 'button[mk-icon-button], a[mk-icon-button]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-icon-button',
    '[attr.data-size]': 'size()',
    '[attr.data-tone]': 'tone()',
  },
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--tap-target);
      height: var(--tap-target);
      padding: 0;
      border: 0;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--icon);
      cursor: pointer;
      text-decoration: none;
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    :host([data-tone='accent']) {
      color: var(--accent);
    }
    :host([data-size='sm']) {
      width: 36px;
      height: 36px;
    }
    :host([data-size='sm'])::after {
      content: '';
      position: absolute;
      inset: -4px;
    }
    :host(:active) {
      background: var(--surface-2);
    }
    :host([disabled]) {
      color: var(--ink-3);
      cursor: not-allowed;
    }
  `,
  template: `<ng-content />`,
})
export class MkIconButtonComponent {
  readonly size = input<IconButtonSize>('md')
  readonly tone = input<'icon' | 'accent'>('icon')
}
