import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'

/**
 * print: the only tinted band ("Bring this printed", `print-warning`).
 * saved: `surface-2`, "Showing saved data…". critical: `surface-2` with the
 * icon in `status-critical`. info: `surface-2`, neutral icon.
 */
export type BannerTone = 'print' | 'saved' | 'critical' | 'info'

/**
 * A full-width band (edge to edge inside mk-page, no radius, no border):
 * icon, a bold line, an optional caption line and one optional action
 * (`[mkBannerAction]`, a ghost button or a link). On the print banner the
 * action takes `on-print-warning` and an underline.
 */
@Component({
  selector: 'mk-banner',
  imports: [MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-banner', '[attr.data-tone]': 'tone()', '[attr.role]': 'role()' },
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin-inline: calc(-1 * var(--page-gutter, 0px));
      padding: 12px max(var(--page-gutter, 0px), var(--space-2));
      background: var(--surface-2);
      color: var(--ink-1);
    }
    :host([data-tone='print']) {
      background: var(--print-warning);
      color: var(--on-print-warning);
    }
    .mk-banner__icon {
      color: var(--icon);
    }
    :host([data-tone='print']) .mk-banner__icon {
      color: var(--on-print-warning);
    }
    :host([data-tone='critical']) .mk-banner__icon {
      color: var(--status-critical);
    }
    .mk-banner__text {
      flex: 1 1 0;
      min-width: 0;
    }
    .mk-banner__title {
      margin: 0;
      font-weight: 600;
    }
    .mk-banner__body {
      margin: 0;
      color: var(--ink-2);
    }
    :host([data-tone='print']) .mk-banner__body {
      color: var(--on-print-warning-2);
    }
    .mk-banner__action {
      flex: none;
    }
    :host([data-tone='print']) .mk-banner__action {
      color: var(--on-print-warning);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  `,
  template: `
    <mk-icon class="mk-banner__icon" [name]="icon()" />
    <div class="mk-banner__text">
      <p class="mk-banner__title mk-type-body-strong">{{ title() }}</p>
      @if (body(); as body) {
        <p class="mk-banner__body mk-type-caption">{{ body }}</p>
      }
    </div>
    <div class="mk-banner__action"><ng-content select="[mkBannerAction]" /></div>
  `,
})
export class MkBannerComponent {
  readonly tone = input<BannerTone>('info')
  readonly icon = input.required<IconName>()
  readonly title = input.required<string>()
  readonly body = input<string>()
  /** `status` for information, `alert` for something that needs attention now. */
  readonly role = input<'status' | 'alert'>('status')
}
