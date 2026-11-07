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
import { provideUiI18n } from '../ui-i18n'

/**
 * Label + projected control + hint or translated error, for Signal Forms or
 * any native control. The control is projected inside the `<label>`, so it
 * is labelled without ids. Pass the first error of the field (`kind` plus
 * details): the message comes from the `ui` catalogue, or from the error's
 * own `message` when the validator produced one.
 *
 * Styles are global (prefixed with `.mk-field`) so the projected control
 * gets the field look without `::ng-deep`.
 */
@Component({
  selector: 'mk-field',
  imports: [TranslocoPipe],
  providers: [provideUiI18n()],
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
      gap: 0.375rem;
    }
    .mk-field__label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--ink-2);
    }
    .mk-field__hint {
      font-size: 0.75rem;
      color: var(--ink-3);
    }
    .mk-field__error {
      display: inline-flex;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: var(--status-critical);
    }
    .mk-field input,
    .mk-field select,
    .mk-field textarea {
      min-height: 2.75rem;
      padding: 0 0.75rem;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: var(--surface-1);
      color: var(--ink-1);
      font: inherit;
    }
    .mk-field--invalid input,
    .mk-field--invalid select,
    .mk-field--invalid textarea {
      border-color: var(--status-critical);
    }
  `,
  template: `
    <!-- The control is projected into the label (implicit association), which the lint rule cannot see. -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label>
      <span class="mk-field__label">
        {{ label() }}
        @if (required()) {
          <span aria-hidden="true">*</span>
          <span class="sr-only">({{ 'ui.field.required' | transloco }})</span>
        }
      </span>
      <ng-content />
      @if (error(); as error) {
        <span class="mk-field__error" role="alert">
          {{ error.message || (errorKey() | transloco: errorParams()) }}
        </span>
      } @else if (hint(); as hint) {
        <span class="mk-field__hint">{{ hint }}</span>
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
