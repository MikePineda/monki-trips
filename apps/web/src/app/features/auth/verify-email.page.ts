import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core'
import { form, FormField, maxLength, pattern, required, submit } from '@angular/forms/signals'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { ApiFailure } from '../../core/api/api-failure'
import { AUTH_API } from '../../core/api/auth-api'
import { fieldError } from '../../core/forms/field-error'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { provideUiI18n } from '../../shared/ui/ui-i18n'
import { AUTH_ERROR_CODES, provideAuthI18n } from './auth-i18n'
import { HOME_URL } from './login.page'

/** Seconds before "send a new code" can be used again. */
export const RESEND_COOLDOWN_SECONDS = 60

const CODE_LENGTH = 6
const CODE_PATTERN = /^\d{6}$/

type VerifyState =
  | 'checking-link'
  | 'verified'
  | 'link-expired'
  | 'link-failed'
  | 'anonymous'
  | 'already-verified'
  | 'code'

/**
 * `/verify-email`: with `?token=` the link from the mail is redeemed at
 * once (works on any device, signed in or not); without it, the signed-in
 * person types the 6-digit code from the same mail. "Send a new code" waits
 * a minute between uses.
 */
@Component({
  selector: 'app-verify-email-page',
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
    @switch (state()) {
      @case ('checking-link') {
        <p class="text-sm text-ink-2">{{ 'auth.verify.checkingLink' | transloco }}</p>
        <mk-skeleton class="mt-4" [rows]="2" data-testid="auth.verify.loading" />
      }
      @case ('verified') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="circle-check"
          [title]="'auth.verify.verifiedTitle' | transloco"
          [body]="'auth.verify.verifiedBody' | transloco"
          data-testid="auth.verify.done"
        >
          <a
            mkEmptyAction
            mk-button
            [routerLink]="continueUrl()"
            data-testid="auth.verify.continue"
          >
            {{ 'auth.verify.continue' | transloco }}
          </a>
        </mk-empty-state>
      }
      @case ('already-verified') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="circle-check"
          [title]="'auth.verify.alreadyVerified' | transloco"
          data-testid="auth.verify.already"
        >
          <a
            mkEmptyAction
            mk-button
            [routerLink]="continueUrl()"
            data-testid="auth.verify.continue"
          >
            {{ 'auth.verify.continue' | transloco }}
          </a>
        </mk-empty-state>
      }
      @case ('link-expired') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="circle-alert"
          [title]="'auth.verify.linkExpiredTitle' | transloco"
          [body]="'auth.verify.linkExpiredBody' | transloco"
          data-testid="auth.verify.expired"
        >
          <a mkEmptyAction mk-button variant="secondary" routerLink="/verify-email">
            {{ 'auth.verify.title' | transloco }}
          </a>
        </mk-empty-state>
      }
      @case ('link-failed') {
        <mk-api-error [failure]="linkFailure()" scope="auth" [knownCodes]="codes" />
        <button mk-button variant="secondary" class="mt-4" type="button" (click)="redeemLink()">
          {{ 'ui.actions.retry' | transloco }}
        </button>
      }
      @case ('anonymous') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="info"
          [title]="'auth.verify.title' | transloco"
          [body]="'auth.verify.signInFirst' | transloco"
          data-testid="auth.verify.anonymous"
        >
          <a
            mkEmptyAction
            mk-button
            routerLink="/login"
            [queryParams]="{ returnUrl: '/verify-email' }"
            data-testid="auth.verify.login"
          >
            {{ 'auth.login.title' | transloco }}
          </a>
        </mk-empty-state>
      }
      @case ('code') {
        <h1 class="text-xl font-semibold text-ink-1">{{ 'auth.verify.title' | transloco }}</h1>
        <p class="mt-3 text-sm text-ink-2">
          {{ 'auth.verify.body' | transloco: { email: session.user()?.email } }}
        </p>
        <form class="mt-6 flex flex-col gap-4" novalidate (submit)="verify($event)">
          <mk-field
            [label]="'auth.verify.code' | transloco"
            [hint]="'auth.verify.codeHint' | transloco"
            [required]="true"
            [error]="fieldError(form.code)"
          >
            <input
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              class="font-mono tracking-widest tabular-nums"
              [formField]="form.code"
              (input)="keepDigits($event)"
              data-testid="auth.verify.code"
            />
          </mk-field>
          <mk-api-error
            [failure]="failure()"
            scope="auth"
            [knownCodes]="codes"
            testId="auth.verify.error"
          />
          <button mk-button type="submit" [loading]="busy()" data-testid="auth.verify.submit">
            {{ 'auth.verify.submit' | transloco }}
          </button>
          <button
            mk-button
            variant="ghost"
            type="button"
            [disabled]="cooldown() > 0"
            data-testid="auth.verify.resend"
            (click)="resend()"
          >
            @if (cooldown() > 0) {
              {{ 'auth.verify.resendIn' | transloco: { seconds: cooldown() } }}
            } @else {
              {{ 'auth.verify.resend' | transloco }}
            }
          </button>
          @if (resent()) {
            <p class="text-sm text-ink-2" role="status" data-testid="auth.verify.sent">
              {{ 'auth.verify.sent' | transloco }}
            </p>
          }
        </form>
      }
    }
  `,
})
export default class VerifyEmailPage {
  /** Bound from `?token=` by the router: the link from the mail. */
  readonly token = input<string>()

  private readonly auth = inject(AUTH_API)
  private readonly router = inject(Router)
  private readonly destroyRef = inject(DestroyRef)
  protected readonly session = inject(SessionStore)

  protected readonly codes = AUTH_ERROR_CODES
  protected readonly fieldError = fieldError
  protected readonly model = signal({ code: '' })
  protected readonly form = form(this.model, (path) => {
    required(path.code)
    maxLength(path.code, CODE_LENGTH)
    pattern(path.code, CODE_PATTERN)
  })
  protected readonly busy = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)
  protected readonly linkFailure = signal<ApiFailure | null>(null)
  protected readonly verified = signal(false)
  protected readonly linkChecked = signal(false)
  /** The link's token, kept after it leaves the address bar so the outcome stays on screen. */
  private readonly linkToken = signal<string | null>(null)
  protected readonly cooldown = signal(0)
  protected readonly resent = signal(false)
  private cooldownTimer: ReturnType<typeof setInterval> | null = null

  protected readonly state = computed<VerifyState>(() => {
    if (this.verified()) {
      return 'verified'
    }
    if (this.token() || this.linkToken()) {
      const failure = this.linkFailure()
      if (!this.linkChecked()) {
        return 'checking-link'
      }
      if (failure?.isStatus(410)) {
        return 'link-expired'
      }
      return 'link-failed'
    }
    const sessionState = this.session.state()
    if (sessionState !== 'signed-in') {
      return sessionState === 'unknown' ? 'checking-link' : 'anonymous'
    }
    return this.session.emailVerified() ? 'already-verified' : 'code'
  })

  constructor() {
    void this.session.restore()
    // Inputs arrive after construction: redeem the link once the token is bound.
    effect(() => {
      if (this.token()) {
        untracked(() => void this.redeemLink())
      }
    })
    this.destroyRef.onDestroy(() => this.stopCooldown())
  }

  protected continueUrl(): string {
    return HOME_URL
  }

  protected async redeemLink(): Promise<void> {
    const token = this.token()
    if (!token) {
      return
    }
    this.linkToken.set(token)
    this.linkChecked.set(false)
    this.linkFailure.set(null)
    try {
      await this.auth.verifyEmail(token)
      this.verified.set(true)
      if (this.session.signedIn()) {
        await this.session.refresh().catch(() => undefined)
      }
    } catch (error) {
      this.linkFailure.set(toFailure(error))
    } finally {
      this.linkChecked.set(true)
    }
    // Single use either way: keep it out of the address bar and the history.
    await this.router.navigate(['/verify-email'], { replaceUrl: true }).catch(() => false)
  }

  /** Only digits, at most six: the field never holds what the API would refuse. */
  protected keepDigits(event: Event): void {
    const input = event.target as HTMLInputElement
    const digits = input.value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (digits !== input.value) {
      input.value = digits
    }
    this.form.code().value.set(digits)
  }

  protected async verify(event: Event): Promise<void> {
    event.preventDefault()
    this.failure.set(null)
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        const user = await this.auth.verifyCode(this.model().code)
        await this.session.setUser(user)
        this.verified.set(true)
        return undefined
      } catch (error) {
        const failure = toFailure(error)
        if (!(await this.session.handleUnauthorized(failure, '/verify-email'))) {
          this.failure.set(failure)
        }
        return undefined
      } finally {
        this.busy.set(false)
      }
    })
  }

  protected async resend(): Promise<void> {
    if (this.cooldown() > 0) {
      return
    }
    this.failure.set(null)
    this.resent.set(false)
    try {
      await this.auth.resendVerification()
      this.resent.set(true)
      this.startCooldown()
    } catch (error) {
      const failure = toFailure(error)
      if (failure.isStatus(429)) {
        // Throttled: wait as long as the server asks before offering it again.
        this.startCooldown(failure.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS)
      }
      if (!(await this.session.handleUnauthorized(failure, '/verify-email'))) {
        this.failure.set(failure)
      }
    }
  }

  private startCooldown(seconds = RESEND_COOLDOWN_SECONDS): void {
    this.cooldown.set(Math.max(1, Math.ceil(seconds)))
    this.stopCooldown()
    this.cooldownTimer = setInterval(() => {
      this.cooldown.update((left) => Math.max(0, left - 1))
      if (this.cooldown() === 0) {
        this.stopCooldown()
      }
    }, 1000)
  }

  private stopCooldown(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer)
      this.cooldownTimer = null
    }
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
