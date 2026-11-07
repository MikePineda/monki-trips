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
  host: { class: 'block' },
  template: `
    @if (message(); as message) {
      <p
        class="flex items-start gap-2 rounded-lg border border-status-critical bg-surface-1 px-3 py-2 text-sm text-ink-1"
        role="alert"
        [attr.data-testid]="testId()"
        [attr.data-code]="failure()?.code ?? failure()?.kind"
      >
        <mk-icon name="circle-alert" class="mt-0.5 shrink-0 text-status-critical" [size]="18" />
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
