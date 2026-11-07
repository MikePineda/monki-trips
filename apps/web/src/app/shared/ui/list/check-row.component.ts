import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'
import type { RowStatus } from './list-row.component'

/**
 * A task or checklist row: a 24 px checkbox (role="checkbox", 44 px hit
 * area) in `line-strong` that fills with the accent and a check when done,
 * the title (struck through in ink-3 once done), a meta line, an optional
 * status (icon + word) and room for actions at the end (`[mkRowTrailing]`).
 * Controlled like `mk-switch`: `checked` is what the owner says and
 * `checkedChange` asks for the other state. `pending` shows the dot and
 * the word "pending" while the change waits for the server.
 */
@Component({
  selector: 'mk-check-row',
  imports: [MkIconComponent, TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-check-row',
    'role': 'listitem',
    '[attr.data-checked]': 'checked() ? "" : null',
    '[attr.data-pending]': 'pending() ? "" : null',
    '[attr.data-testid]': 'testId()',
  },
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      min-height: var(--row-height);
      padding: var(--space-half) 0;
      box-sizing: border-box;
      color: var(--ink-1);
    }
    :host(:not(:last-child)) {
      border-bottom: 1px solid var(--line);
    }
    .mk-check-row__toggle {
      position: relative;
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--tap-target);
      height: var(--tap-target);
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--surface-1);
      cursor: pointer;
    }
    .mk-check-row__box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: 1.5px solid var(--line-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-1);
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    .mk-check-row__toggle[aria-checked='true'] .mk-check-row__box {
      border-color: var(--accent);
      background: var(--accent);
    }
    .mk-check-row__toggle[disabled] {
      cursor: not-allowed;
    }
    .mk-check-row__text {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-width: 0;
    }
    .mk-check-row__title {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    :host([data-checked]) .mk-check-row__title {
      color: var(--ink-3);
      text-decoration: line-through;
    }
    .mk-check-row__meta {
      color: var(--ink-3);
    }
    .mk-check-row__status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      color: var(--ink-2);
      white-space: nowrap;
    }
    .mk-check-row__status[data-tone='warning'] mk-icon {
      color: var(--status-warning);
    }
    .mk-check-row__status[data-tone='serious'] mk-icon {
      color: var(--status-serious);
    }
    .mk-check-row__status[data-tone='critical'] mk-icon {
      color: var(--status-critical);
    }
    .mk-check-row__status[data-tone='good'] mk-icon {
      color: var(--status-good);
    }
    .mk-check-row__pending {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      color: var(--ink-3);
      white-space: nowrap;
    }
    .mk-check-row__dot {
      width: 6px;
      height: 6px;
      border-radius: var(--radius-full);
      background: var(--ink-3);
    }
    @media (prefers-reduced-motion: reduce) {
      .mk-check-row__box {
        transition: none;
      }
    }
  `,
  template: `
    <button
      type="button"
      role="checkbox"
      class="mk-check-row__toggle"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="title()"
      [attr.disabled]="disabled() ? '' : null"
      [attr.data-testid]="testId() ? testId() + '.toggle' : null"
      (click)="checkedChange.emit(!checked())"
    >
      <span class="mk-check-row__box" aria-hidden="true">
        @if (checked()) {
          <mk-icon name="check" [size]="16" />
        }
      </span>
    </button>
    <span class="mk-check-row__text">
      <span class="mk-check-row__title mk-type-body-strong">{{ title() }}</span>
      @if (meta(); as meta) {
        <span class="mk-check-row__meta mk-type-caption">{{ meta }}</span>
      }
    </span>
    @if (pending()) {
      <span class="mk-check-row__pending mk-type-caption" data-testid="ui.checkRow.pending">
        <span class="mk-check-row__dot" aria-hidden="true"></span>
        {{ 'ui.checkRow.pending' | transloco }}
      </span>
    }
    @if (status(); as status) {
      <span class="mk-check-row__status mk-type-label" [attr.data-tone]="status.tone">
        <mk-icon [name]="status.icon" [size]="16" />
        {{ status.label }}
      </span>
    }
    <ng-content select="[mkRowTrailing]" />
  `,
})
export class MkCheckRowComponent {
  readonly title = input.required<string>()
  readonly meta = input<string>()
  readonly checked = input(false)
  readonly disabled = input(false)
  /** The change still waits for the server. */
  readonly pending = input(false)
  readonly status = input<RowStatus>()
  readonly testId = input<string>()
  /** The state the person asked for; the owner decides whether it happens. */
  readonly checkedChange = output<boolean>()
}
