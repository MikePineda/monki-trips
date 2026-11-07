import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import type { ApiFailure } from '../../../core/api/api-failure'
import { failureMessage } from '../../../core/api/failure-message'
import { MkIconComponent } from '../icon/icon.component'

/**
 * The form-level message of a failed API call: the code's entry in the host
 * feature's catalogue (`<scope>.errors.<code>`, so it follows the UI
 * language), the server's own message for a code the catalogue does not
 * know, or the `network` entry when nothing answered. The host page
 * provides the Transloco scope; nothing renders without a failure.
 */
@Component({
  selector: 'mk-api-error',
  imports: [TranslocoPipe, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-api-error' },
  styles: `
    :host {
      display: block;
    }
    .mk-api-error__message {
      display: flex;
      align-items: flex-start;
      gap: var(--space-1);
      margin: 0;
      padding: var(--space-1) 12px;
      border: 1px solid var(--status-critical);
      border-radius: var(--radius-md);
      background: var(--surface-1);
      color: var(--ink-1);
    }
    .mk-api-error__icon {
      flex-shrink: 0;
      margin-top: 2px;
      color: var(--status-critical);
    }
  `,
  template: `
    @if (message(); as message) {
      <p
        class="mk-api-error__message mk-type-body"
        role="alert"
        [attr.data-testid]="testId()"
        [attr.data-code]="failure()?.code ?? failure()?.kind"
      >
        <mk-icon name="circle-alert" class="mk-api-error__icon" [size]="18" />
        <span>
          @if (message.key.endsWith('.unknown') && message.fallback) {
            {{ message.fallback }}
          } @else {
            {{ message.key | transloco: message.params }}
          }
        </span>
      </p>
    }
  `,
})
export class MkApiErrorComponent {
  readonly failure = input<ApiFailure | null>(null)
  /** The host feature's scope name (`auth`, `account`). */
  readonly scope = input.required<string>()
  /** Codes that scope has an `errors.<code>` entry for. */
  readonly knownCodes = input.required<readonly string[]>()
  readonly testId = input('ui.apiError')

  protected readonly message = computed(() => {
    const failure = this.failure()
    return failure ? failureMessage(failure, this.scope(), this.knownCodes()) : null
  })
}
