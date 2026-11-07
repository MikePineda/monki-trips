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
import { email, form, FormField, minLength, required, submit } from '@angular/forms/signals'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import type { AppConfig, TripInvitationPreview } from '@monkitrips/shared'
import { ApiFailure } from '../../core/api/api-failure'
import { AUTH_API } from '../../core/api/auth-api'
import { fieldError } from '../../core/forms/field-error'
import { serverFieldErrors } from '../../core/forms/server-errors'
import { LangStore } from '../../core/i18n/lang.store'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { provideUiI18n } from '../../shared/ui/ui-i18n'
import { AUTH_ERROR_CODES, provideAuthI18n } from './auth-i18n'
import { HOME_URL } from './login.page'

/** Shortest password the API accepts. */
export const PASSWORD_MIN_LENGTH = 10

/**
 * Account creation. The form shows only when `GET /config` says registration
 * is open or an invitation token came along (`?invitation=`); with a token
 * the invitation is previewed first (trip name and role). An invitation sent
 * to the same address also verifies it, so the person lands on the trips;
 * otherwise on the verification screen.
 */
@Component({
  selector: 'app-signup-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    MkFieldComponent,
    MkButtonComponent,
    MkApiErrorComponent,
    MkEmptyStateComponent,
    MkSkeletonComponent,
  ],
  providers: [provideAuthI18n(), provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'auth.signup.title' | transloco }}</h1>
    @if (loading()) {
      <mk-skeleton class="mt-6" [rows]="4" data-testid="signup.loading" />
    } @else if (loadFailure(); as failure) {
      <mk-api-error class="mt-6" [failure]="failure" scope="auth" [knownCodes]="codes" />
      <button mk-button variant="secondary" class="mt-4" type="button" (click)="load()">
        {{ 'ui.actions.retry' | transloco }}
      </button>
    } @else if (!open()) {
      <mk-empty-state
        class="mt-6 rounded-lg border border-line bg-surface-1"
        icon="info"
        [title]="'auth.signup.closedTitle' | transloco"
        [body]="'auth.signup.closedBody' | transloco"
        data-testid="signup.closed"
      >
        <a
          mkEmptyAction
          mk-button
          variant="secondary"
          routerLink="/login"
          data-testid="signup.login"
        >
          {{ 'auth.signup.login' | transloco }}
        </a>
      </mk-empty-state>
    } @else {
      @if (preview(); as preview) {
        <p class="mt-3 text-sm text-ink-2" data-testid="signup.invited">
          {{
            'auth.signup.invited'
              | transloco
                : { tripName: preview.tripName, role: 'auth.role.' + preview.role | transloco }
          }}
          @if (preview.requiresEmail) {
            {{ 'auth.signup.invitedEmail' | transloco }}
          }
        </p>
      }
      <form class="mt-6 flex flex-col gap-4" novalidate (submit)="signUp($event)">
        <mk-field
          [label]="'auth.signup.displayName' | transloco"
          [hint]="'auth.signup.displayNameHint' | transloco"
          [required]="true"
          [error]="fieldError(form.displayName)"
        >
          <input
            type="text"
            autocomplete="name"
            [formField]="form.displayName"
            data-testid="signup.displayName"
          />
        </mk-field>
        <mk-field
          [label]="'auth.signup.email' | transloco"
          [required]="true"
          [error]="fieldError(form.email)"
        >
          <input
            type="email"
            autocomplete="email"
            inputmode="email"
            autocapitalize="none"
            [formField]="form.email"
            data-testid="signup.email"
          />
        </mk-field>
        <mk-field
          [label]="'auth.signup.password' | transloco"
          [hint]="'auth.signup.passwordHint' | transloco"
          [required]="true"
          [error]="fieldError(form.password)"
        >
          <input
            type="password"
            autocomplete="new-password"
            [formField]="form.password"
            data-testid="signup.password"
          />
        </mk-field>
        <mk-api-error
          [failure]="failure()"
          scope="auth"
          [knownCodes]="codes"
          testId="signup.error"
        />
        <button mk-button type="submit" [loading]="busy()" data-testid="signup.submit">
          {{ 'auth.signup.submit' | transloco }}
        </button>
      </form>
      <p class="mt-6 text-sm text-ink-2">
        {{ 'auth.signup.haveAccount' | transloco }}
        <a routerLink="/login" class="font-medium text-accent" data-testid="signup.login">
          {{ 'auth.signup.login' | transloco }}
        </a>
      </p>
    }
  `,
})
export default class SignupPage {
  /** Bound from `?invitation=` by the router. */
  readonly invitation = input<string>()

  private readonly auth = inject(AUTH_API)
  private readonly session = inject(SessionStore)
  private readonly lang = inject(LangStore)
  private readonly router = inject(Router)

  protected readonly codes = AUTH_ERROR_CODES
  protected readonly fieldError = fieldError
  protected readonly loading = signal(true)
  protected readonly loadFailure = signal<ApiFailure | null>(null)
  protected readonly config = signal<AppConfig | null>(null)
  protected readonly preview = signal<TripInvitationPreview | null>(null)
  protected readonly open = computed(
    () => this.config()?.registrationOpen === true || !!this.invitation()
  )

  protected readonly model = signal({ displayName: '', email: '', password: '' })
  protected readonly form = form(this.model, (path) => {
    required(path.displayName)
    required(path.email)
    email(path.email)
    required(path.password)
    minLength(path.password, PASSWORD_MIN_LENGTH)
  })
  protected readonly busy = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)

  constructor() {
    effect(() => {
      this.invitation()
      untracked(() => void this.load())
    })
  }

  protected async load(): Promise<void> {
    this.loading.set(true)
    this.loadFailure.set(null)
    const token = this.invitation()
    try {
      const [config, preview] = await Promise.all([
        this.auth.config(),
        token ? this.auth.invitationPreview(token) : Promise.resolve(null),
      ])
      this.config.set(config)
      this.preview.set(preview)
    } catch (error) {
      this.loadFailure.set(toFailure(error))
    } finally {
      this.loading.set(false)
    }
  }

  protected async signUp(event: Event): Promise<void> {
    event.preventDefault()
    this.failure.set(null)
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        const user = await this.auth.signup({
          ...this.model(),
          invitationToken: this.invitation() || undefined,
          locale: this.lang.lang(),
          timezone: deviceTimeZone(),
        })
        await this.session.setUser(user)
        await this.router.navigateByUrl(user.emailVerifiedAt ? HOME_URL : '/verify-email')
        return undefined
      } catch (error) {
        const failure = toFailure(error)
        this.failure.set(failure)
        return serverFieldErrors(failure, this.form)
      } finally {
        this.busy.set(false)
      }
    })
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}

/** The device's IANA zone, or undefined when the runtime cannot say (the API defaults to UTC). */
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}
