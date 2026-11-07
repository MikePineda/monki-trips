import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'

/**
 * An on/off setting on a native `<button role="switch">`: a 44 px track
 * in `line-strong` that turns accent when on (interaction colour, never
 * data), a `surface-1` thumb, the label as projected content. Controlled:
 * `checked` is what the owner says it is and `checkedChange` asks for the
 * other state, so the thumb never shows a state that did not happen
 * (enabling notifications can fail or be refused). `disabled` while the
 * change is in flight.
 */
@Component({
  selector: 'mk-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-switch' },
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
    }
    .mk-switch__control {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--tap-target);
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--ink-1);
      text-align: start;
      cursor: pointer;
    }
    .mk-switch__track {
      position: relative;
      flex-shrink: 0;
      width: 44px;
      height: 26px;
      border-radius: var(--radius-full);
      background: var(--line-strong);
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    .mk-switch__thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      border-radius: var(--radius-full);
      background: var(--surface-1);
      box-shadow: var(--elevation-1);
      transition: transform var(--duration-fast) var(--ease-out);
    }
    .mk-switch__control[aria-checked='true'] .mk-switch__track {
      background: var(--accent);
    }
    .mk-switch__control[aria-checked='true'] .mk-switch__thumb {
      transform: translateX(18px);
    }
    .mk-switch__control[disabled] {
      cursor: not-allowed;
      color: var(--ink-3);
    }
    .mk-switch__control[disabled] .mk-switch__track {
      background: var(--line);
    }
    @media (prefers-reduced-motion: reduce) {
      .mk-switch__track,
      .mk-switch__thumb {
        transition: none;
      }
    }
  `,
  template: `
    <button
      type="button"
      role="switch"
      class="mk-switch__control"
      [attr.aria-checked]="checked()"
      [attr.disabled]="disabled() ? '' : null"
      [attr.data-testid]="testId()"
      (click)="checkedChange.emit(!checked())"
    >
      <span class="mk-switch__track" aria-hidden="true">
        <span class="mk-switch__thumb"></span>
      </span>
      <span class="mk-switch__label mk-type-body"><ng-content /></span>
    </button>
  `,
})
export class MkSwitchComponent {
  readonly checked = input(false)
  readonly disabled = input(false)
  readonly testId = input<string>()
  /** The state the person asked for; the owner decides whether it happens. */
  readonly checkedChange = output<boolean>()
}
