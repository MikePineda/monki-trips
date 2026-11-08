import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import {
  formMessageKey,
  formMessageParams,
  type FieldError,
} from '../../../core/i18n/form-messages'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'

/**
 * Label above (never placeholder-only) + projected control (`<input
 * mkInput>`) + hint or translated error, for Signal Forms or any native
 * control. The control is projected inside the `<label>`, so it is
 * labelled without ids. Pass the first error of the field (`kind` plus
 * details): the message comes from the `ui` catalogue, or from the error's
 * own `message` when the validator produced one; it ships with circle-x.
 *
 * Styles are global (prefixed with `.mk-field` / `.mk-input`) so the
 * projected control gets the field look without `::ng-deep`.
 */
@Component({
  selector: 'mk-field',
  imports: [TranslocoPipe, MkIconComponent],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { 'class': 'mk-field', '[class.mk-field--invalid]': '!!error()' },
  styles: `
    .mk-field {
      display: block;
    }
    .mk-field > label {
      display: flex;
      flex-direction: column;
      gap: var(--space-half);
    }
    .mk-field__label {
      color: var(--ink-2);
    }
    .mk-field__hint {
      color: var(--ink-3);
    }
    .mk-field__error {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      color: var(--status-critical);
    }
    .mk-field .mk-input {
      box-sizing: border-box;
      width: 100%;
      min-height: var(--space-6);
      padding: 0 var(--space-2);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      background: var(--surface-1);
      color: var(--ink-1);
      font: 400 16px/24px var(--font-sans);
      font-variant-numeric: tabular-nums;
    }
    .mk-field textarea.mk-input {
      min-height: calc(var(--space-6) * 2);
      padding: var(--space-1) var(--space-2);
    }
    /* Date and time inputs focus an inner field, so :focus-visible never matches them. */
    .mk-field .mk-input:focus,
    .mk-field .mk-input:focus-within {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .mk-field .mk-input::placeholder {
      color: var(--ink-3);
    }
    .mk-field .mk-input[data-variant='code'] {
      font: 500 16px/24px var(--font-mono);
      letter-spacing: 0.02em;
    }
    .mk-field--invalid .mk-input {
      border-color: var(--status-critical);
    }
  `,
  template: `
    <!-- The control is projected into the label (implicit association), which the lint rule cannot see. -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label>
      <span class="mk-field__label mk-type-label">
        {{ label() }}
        @if (required()) {
          <span aria-hidden="true">*</span>
          <span class="mk-sr-only">({{ 'ui.field.required' | transloco }})</span>
        }
      </span>
      <ng-content />
      @if (error(); as error) {
        <span class="mk-field__error mk-type-caption" role="alert">
          <mk-icon name="circle-x" [size]="16" />
          {{ error.message || (errorKey() | transloco: errorParams()) }}
        </span>
      } @else if (hint(); as hint) {
        <span class="mk-field__hint mk-type-caption">{{ hint }}</span>
      }
    </label>
  `,
})
export class MkFieldComponent {
  readonly label = input.required<string>()
  readonly hint = input<string>()
  readonly required = input(false)
  readonly error = input<FieldError | null | undefined>(null)

  protected readonly errorKey = computed(() => {
    const error = this.error()
    return error ? formMessageKey(error) : ''
  })

  protected readonly errorParams = computed(() => {
    const error = this.error()
    return error ? formMessageParams(error) : {}
  })
}
