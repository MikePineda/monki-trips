import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { email, form, FormField, required, submit } from '@angular/forms/signals'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { ApiFailure } from '../../core/api/api-failure'
import { AUTH_API } from '../../core/api/auth-api'
import { fieldError } from '../../core/forms/field-error'
import { serverFieldErrors } from '../../core/forms/server-errors'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { AUTH_ERROR_CODES, provideAuthI18n } from './auth-i18n'

/**
 * `/forgot-password`: asks for the e-mail and always says "check your
 * inbox" (the API answers 202 whether or not the account exists).
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    MkFieldComponent,
    MkButtonComponent,
    MkApiErrorComponent,
    MkEmptyStateComponent,
    MkInputDirective,
    MkStackComponent,
    MkTextComponent,
  ],
  providers: [provideAuthI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sentTo(); as sentTo) {
      <mk-empty-state
        icon="inbox"
        [title]="'auth.forgot.sentTitle' | transloco"
        [body]="'auth.forgot.sentBody' | transloco: { email: sentTo }"
        data-testid="auth.forgot.sent"
      >
        <a
          mkEmptyAction
          mk-button
          variant="secondary"
          routerLink="/login"
          data-testid="auth.forgot.back"
        >
          {{ 'auth.forgot.back' | transloco }}
        </a>
      </mk-empty-state>
    } @else {
      <mk-stack gap="3">
        <mk-stack gap="1">
          <h1 mk-text variant="title">{{ 'auth.forgot.title' | transloco }}</h1>
          <p mk-text tone="ink-2">{{ 'auth.forgot.body' | transloco }}</p>
        </mk-stack>
        <form novalidate (submit)="send($event)">
          <mk-stack gap="2">
            <mk-field
              [label]="'auth.forgot.email' | transloco"
              [required]="true"
              [error]="fieldError(form.email)"
            >
              <input
                mkInput
                type="email"
                autocomplete="email"
                inputmode="email"
                autocapitalize="none"
                [formField]="form.email"
                data-testid="auth.forgot.email"
              />
            </mk-field>
            <mk-api-error
              [failure]="failure()"
              scope="auth"
              [knownCodes]="codes"
              testId="auth.forgot.error"
            />
            <button mk-button type="submit" [loading]="busy()" data-testid="auth.forgot.submit">
              {{ 'auth.forgot.submit' | transloco }}
            </button>
          </mk-stack>
        </form>
        <a
          mk-text
          variant="body-strong"
          tone="accent"
          routerLink="/login"
          data-testid="auth.forgot.back"
        >
          {{ 'auth.forgot.back' | transloco }}
        </a>
      </mk-stack>
    }
  `,
})
export default class ForgotPasswordPage {
  private readonly auth = inject(AUTH_API)

  protected readonly codes = AUTH_ERROR_CODES
  protected readonly fieldError = fieldError
  protected readonly model = signal({ email: '' })
  protected readonly form = form(this.model, (path) => {
    required(path.email)
    email(path.email)
  })
  protected readonly busy = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)
  protected readonly sentTo = signal<string | null>(null)

  protected async send(event: Event): Promise<void> {
    event.preventDefault()
    this.failure.set(null)
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        await this.auth.forgotPassword(this.model().email)
        this.sentTo.set(this.model().email)
        return undefined
      } catch (error) {
        const failure =
          error instanceof ApiFailure
            ? error
            : new ApiFailure({ kind: 'network', message: String(error) })
        this.failure.set(failure)
        return serverFieldErrors(failure, this.form)
      } finally {
        this.busy.set(false)
      }
    })
  }
}
