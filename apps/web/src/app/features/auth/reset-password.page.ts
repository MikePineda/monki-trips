import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core'
import { form, FormField, minLength, required, submit } from '@angular/forms/signals'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { ApiFailure } from '../../core/api/api-failure'
import { AUTH_API } from '../../core/api/auth-api'
import { fieldError } from '../../core/forms/field-error'
import { serverFieldErrors } from '../../core/forms/server-errors'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { AUTH_ERROR_CODES, provideAuthI18n } from './auth-i18n'
import { PASSWORD_MIN_LENGTH } from './signup.page'

type ResetState = 'missing-token' | 'form' | 'expired' | 'done'

/**
 * `/reset-password?token=`: a new password against the single-use link.
 * Every session ends afterwards, so the screen sends the person to sign in.
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    MkFieldComponent,
    MkButtonComponent,
    MkApiErrorComponent,
    MkEmptyStateComponent,
  ],
  providers: [provideAuthI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('missing-token') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="info"
          [title]="'auth.reset.title' | transloco"
          [body]="'auth.reset.missingToken' | transloco"
          data-testid="reset.missingToken"
        >
          <a mkEmptyAction mk-button variant="secondary" routerLink="/forgot-password">
            {{ 'auth.reset.request' | transloco }}
          </a>
        </mk-empty-state>
      }
      @case ('expired') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="circle-alert"
          [title]="'auth.reset.expiredTitle' | transloco"
          [body]="'auth.reset.expiredBody' | transloco"
          data-testid="reset.expired"
        >
          <a
            mkEmptyAction
            mk-button
            variant="secondary"
            routerLink="/forgot-password"
            data-testid="reset.request"
          >
            {{ 'auth.reset.request' | transloco }}
          </a>
        </mk-empty-state>
      }
      @case ('done') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="circle-check"
          [title]="'auth.reset.doneTitle' | transloco"
          [body]="'auth.reset.doneBody' | transloco"
          data-testid="reset.done"
        >
          <a mkEmptyAction mk-button routerLink="/login" data-testid="reset.login">
            {{ 'auth.reset.login' | transloco }}
          </a>
        </mk-empty-state>
      }
      @case ('form') {
        <h1 class="text-xl font-semibold text-ink-1">{{ 'auth.reset.title' | transloco }}</h1>
        <form class="mt-6 flex flex-col gap-4" novalidate (submit)="change($event)">
          <mk-field
            [label]="'auth.reset.password' | transloco"
            [hint]="'auth.reset.passwordHint' | transloco"
            [required]="true"
            [error]="fieldError(form.password)"
          >
            <input
              type="password"
              autocomplete="new-password"
              [formField]="form.password"
              data-testid="reset.password"
            />
          </mk-field>
          <mk-api-error
            [failure]="failure()"
            scope="auth"
            [knownCodes]="codes"
            testId="reset.error"
          />
          <button mk-button type="submit" [loading]="busy()" data-testid="reset.submit">
            {{ 'auth.reset.submit' | transloco }}
          </button>
        </form>
      }
    }
  `,
})
export default class ResetPasswordPage {
  /** Bound from `?token=` by the router. */
  readonly token = input<string>()

  private readonly auth = inject(AUTH_API)
  private readonly router = inject(Router)
  /** The link's token, held once it left the address bar. */
  private readonly heldToken = signal<string | null>(null)
  private readonly resetToken = computed(() => this.token() || this.heldToken())

  protected readonly codes = AUTH_ERROR_CODES
  protected readonly fieldError = fieldError
  protected readonly model = signal({ password: '' })
  protected readonly form = form(this.model, (path) => {
    required(path.password)
    minLength(path.password, PASSWORD_MIN_LENGTH)
  })
  protected readonly busy = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)
  protected readonly done = signal(false)
  protected readonly state = computed<ResetState>(() => {
    if (this.done()) {
      return 'done'
    }
    if (!this.resetToken()) {
      return 'missing-token'
    }
    return this.failure()?.isStatus(410) ? 'expired' : 'form'
  })

  constructor() {
    // The token is a single-use credential: the page holds it, the address bar and history do not.
    effect(() => {
      const token = this.token()
      if (token) {
        untracked(() => {
          this.heldToken.set(token)
          void this.router.navigate(['/reset-password'], { replaceUrl: true }).catch(() => false)
        })
      }
    })
  }

  protected async change(event: Event): Promise<void> {
    event.preventDefault()
    this.failure.set(null)
    const token = this.resetToken()
    if (!token) {
      return
    }
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        await this.auth.resetPassword({ token, password: this.model().password })
        this.done.set(true)
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
