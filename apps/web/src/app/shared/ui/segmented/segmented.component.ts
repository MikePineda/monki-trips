import { ChangeDetectionStrategy, Component, input, model } from '@angular/core'

export interface SegmentOption<T extends string = string> {
  id: T
  /** Already translated. */
  label: string
}

/** radiogroup: a setting (theme, language). tablist: switches a view ("Days | Where we sleep"). */
export type SegmentedRole = 'radiogroup' | 'tablist'

/**
 * Two to four mutually exclusive options on a `surface-2` track (radius 8,
 * 2 px inset, 40 px); the selected thumb is `surface-1` with a `line-strong`
 * ring and its label in accent at 600, the others in ink-2. The whole
 * segment is the target. `value` is a two-way binding; each option gets
 * `data-testid="<testId>.<id>"`.
 */
@Component({
  selector: 'mk-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `role` is an input: keep it off the host, only the track carries the role.
  host: { 'class': 'mk-segmented', '[attr.role]': 'null' },
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
    }
    .mk-segmented__track {
      display: inline-grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      min-height: 40px;
      padding: 2px;
      box-sizing: border-box;
      border-radius: var(--radius-md);
      background: var(--surface-2);
      max-width: 100%;
    }
    .mk-segmented__option {
      position: relative;
      min-height: 36px;
      padding: 0 var(--space-2);
      border: 1px solid transparent;
      border-radius: calc(var(--radius-md) - 2px);
      background: transparent;
      color: var(--ink-2);
      cursor: pointer;
      white-space: nowrap;
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    /* 36 px segment, 44 px hit area (inside the 1 px border: 34 + 2 × 5). */
    .mk-segmented__option::after {
      content: '';
      position: absolute;
      inset: -5px -1px;
    }
    .mk-segmented__option[aria-checked='true'],
    .mk-segmented__option[aria-selected='true'] {
      border-color: var(--line-strong);
      background: var(--surface-1);
      color: var(--accent);
      font-weight: 600;
    }
  `,
  template: `
    <div class="mk-segmented__track" [attr.role]="role()" [attr.aria-label]="label()">
      @for (option of options(); track option.id) {
        <button
          type="button"
          class="mk-segmented__option mk-type-label"
          [attr.role]="role() === 'tablist' ? 'tab' : 'radio'"
          [attr.aria-checked]="role() === 'radiogroup' ? value() === option.id : null"
          [attr.aria-selected]="role() === 'tablist' ? value() === option.id : null"
          [attr.data-testid]="testId() ? testId() + '.' + option.id : null"
          [attr.lang]="optionLang() ? option.id : null"
          (click)="value.set(option.id)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class MkSegmentedComponent {
  readonly options = input.required<readonly SegmentOption[]>()
  readonly value = model<string>()
  readonly label = input<string>()
  readonly role = input<SegmentedRole>('radiogroup')
  readonly testId = input<string>()
  /** Language switches: each option is written in its own language, so mark it. */
  readonly optionLang = input(false)
}
