import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core'
import { email, form, FormField, required, submit } from '@angular/forms/signals'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { ApiFailure } from '../../core/api/api-failure'
import { fieldError } from '../../core/forms/field-error'
import { serverFieldErrors } from '../../core/forms/server-errors'
import { ForeignChangesError } from '../../core/session/foreign-changes.error'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { AUTH_ERROR_CODES, provideAuthI18n } from './auth-i18n'
import { resolveForeignChanges } from './foreign-changes'

/** Where to go after signing in when nothing asked for a specific page. */
export const HOME_URL = '/trips'

/** A return url that is an invitation page: `/invite/<token>`. */
const INVITE_RETURN_URL = /^\/invite\/([^/?#]+)$/

/**
 * Sign-in: e-mail and password against `POST /auth/login`. A wrong
 * password says so (401), a throttle says how long to wait (429), no
 * answer says to check the connection. Someone already signed in skips the
 * form. Afterwards the person lands where they were going (`returnUrl`).
 * On a device that holds another account's unsynced changes the person
 * first decides about them (discard and continue, or keep them).
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
    MkInputDirective,
    MkStackComponent,
    MkTextComponent,
  ],
  providers: [provideAuthI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      <h1 mk-text variant="title">{{ 'auth.login.title' | transloco }}</h1>
      <form novalidate (submit)="signIn($event)">
        <mk-stack gap="2">
          <mk-field
            [label]="'auth.login.email' | transloco"
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
              data-testid="auth.login.email"
            />
          </mk-field>
          <mk-field
            [label]="'auth.login.password' | transloco"
            [required]="true"
            [error]="fieldError(form.password)"
          >
            <input
              mkInput
              type="password"
              autocomplete="current-password"
              [formField]="form.password"
              data-testid="auth.login.password"
            />
          </mk-field>
          <mk-api-error
            [failure]="failure()"
            scope="auth"
            [knownCodes]="codes"
            testId="auth.login.error"
          />
          <button mk-button type="submit" [loading]="busy()" data-testid="auth.login.submit">
            {{ 'auth.login.submit' | transloco }}
          </button>
        </mk-stack>
      </form>
      <mk-stack gap="1" align="start">
        <a
          mk-text
          variant="body-strong"
          tone="accent"
          routerLink="/forgot-password"
          data-testid="auth.login.forgot"
        >
          {{ 'auth.login.forgot' | transloco }}
        </a>
        <p mk-text tone="ink-2">
          {{ 'auth.login.noAccount' | transloco }}
          <a
            mk-text
            variant="body-strong"
            tone="accent"
            routerLink="/signup"
            [queryParams]="signupParams()"
            data-testid="auth.login.signup"
          >
            {{ 'auth.login.signup' | transloco }}
          </a>
        </p>
      </mk-stack>
    </mk-stack>
  `,
})
export default class LoginPage {
  /** Bound from the query string by the router: where to go afterwards. */
  readonly returnUrl = input<string>()
  /** A pending invitation token travels with the person to signup. */
  readonly invitation = input<string>()

  private readonly session = inject(SessionStore)
  private readonly router = inject(Router)
  private readonly sheets = inject(SheetService)

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
    // Coming from an invitation, its token is already in the return url.
    const fromReturnUrl = INVITE_RETURN_URL.exec(this.returnUrl() ?? '')?.[1]
    const token = fromReturnUrl ? decodeURIComponent(fromReturnUrl) : this.invitation()
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
        if (error instanceof ForeignChangesError) {
          if (await resolveForeignChanges(error, this.sheets, this.session)) {
            await this.router.navigateByUrl(this.destination())
          }
          return undefined
        }
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
