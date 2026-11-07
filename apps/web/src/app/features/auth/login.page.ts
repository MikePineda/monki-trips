import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core'
import { email, form, FormField, required, submit } from '@angular/forms/signals'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { ApiFailure } from '../../core/api/api-failure'
import { fieldError } from '../../core/forms/field-error'
import { serverFieldErrors } from '../../core/forms/server-errors'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { AUTH_ERROR_CODES, provideAuthI18n } from './auth-i18n'

/** Where to go after signing in when nothing asked for a specific page. */
export const HOME_URL = '/trips'

/**
 * Sign-in: e-mail and password against `POST /auth/login`. A wrong
 * password says so (401), a throttle says how long to wait (429), no
 * answer says to check the connection. Someone already signed in skips the
 * form. Afterwards the person lands where they were going (`returnUrl`).
 */
@Component({
  selector: 'app-login-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    MkFieldComponent,
    MkButtonComponent,
    MkApiErrorComponent,
  ],
  providers: [provideAuthI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'auth.login.title' | transloco }}</h1>
    <form class="mt-6 flex flex-col gap-4" novalidate (submit)="signIn($event)">
      <mk-field
        [label]="'auth.login.email' | transloco"
        [required]="true"
        [error]="fieldError(form.email)"
      >
        <input
          type="email"
          autocomplete="email"
          inputmode="email"
          autocapitalize="none"
          [formField]="form.email"
          data-testid="login.email"
        />
      </mk-field>
      <mk-field
        [label]="'auth.login.password' | transloco"
        [required]="true"
        [error]="fieldError(form.password)"
      >
        <input
          type="password"
          autocomplete="current-password"
          [formField]="form.password"
          data-testid="login.password"
        />
      </mk-field>
      <mk-api-error [failure]="failure()" scope="auth" [knownCodes]="codes" testId="login.error" />
      <button mk-button type="submit" [loading]="busy()" data-testid="login.submit">
        {{ 'auth.login.submit' | transloco }}
      </button>
    </form>
    <p class="mt-6 text-sm">
      <a routerLink="/forgot-password" class="font-medium text-accent" data-testid="login.forgot">
        {{ 'auth.login.forgot' | transloco }}
      </a>
    </p>
    <p class="mt-3 text-sm text-ink-2">
      {{ 'auth.login.noAccount' | transloco }}
      <a
        routerLink="/signup"
        [queryParams]="signupParams()"
        class="font-medium text-accent"
        data-testid="login.signup"
      >
        {{ 'auth.login.signup' | transloco }}
      </a>
    </p>
  `,
})
export default class LoginPage {
  /** Bound from the query string by the router: where to go afterwards. */
  readonly returnUrl = input<string>()
  /** A pending invitation token travels with the person to signup. */
  readonly invitation = input<string>()

  private readonly session = inject(SessionStore)
  private readonly router = inject(Router)

  protected readonly codes = AUTH_ERROR_CODES
  protected readonly fieldError = fieldError
  protected readonly model = signal({ email: '', password: '' })
  protected readonly form = form(this.model, (path) => {
    required(path.email)
    email(path.email)
    required(path.password)
  })
  protected readonly busy = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)

  constructor() {
    // Already signed in (a stale link, the back button): straight to the destination.
    void this.session.restore().then((user) => {
      if (user) {
        return this.router.navigateByUrl(this.destination())
      }
      return undefined
    })
  }

  protected signupParams(): Record<string, string> {
    const token = this.invitation()
    return token ? { invitation: token } : {}
  }

  protected async signIn(event: Event): Promise<void> {
    event.preventDefault()
    this.failure.set(null)
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        await this.session.login(this.model())
        await this.router.navigateByUrl(this.destination())
        return undefined
      } catch (error) {
        const failure = error instanceof ApiFailure ? error : null
        this.failure.set(failure ?? new ApiFailure({ kind: 'network', message: String(error) }))
        return failure ? serverFieldErrors(failure, this.form) : undefined
      } finally {
        this.busy.set(false)
      }
    })
  }

  private destination(): string {
    const target = this.returnUrl()
    // Only paths inside the app: never a full URL somebody pasted into the query string.
    return target && target.startsWith('/') && !target.startsWith('//') ? target : HOME_URL
  }
}
