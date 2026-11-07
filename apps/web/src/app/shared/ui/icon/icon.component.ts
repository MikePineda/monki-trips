import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import type { IconName } from './icon-names'

/**
 * One Lucide icon from the generated sprite (`public/sprite/lucide.svg`,
 * built by scripts/build-icon-sprite.mjs with a 1.75 px stroke). 20 px by
 * default, inherits the text colour. Decorative unless a `label` is given,
 * in which case it is announced as an image.
 */
@Component({
  selector: 'mk-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-icon' },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
      vertical-align: middle;
    }
  `,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
      focusable="false"
    >
      <use [attr.href]="'sprite/lucide.svg#' + name()" />
    </svg>
  `,
})
export class MkIconComponent {
  readonly name = input.required<IconName>()
  readonly size = input(20)
  readonly label = input<string>()
}
