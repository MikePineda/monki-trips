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
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import type { TripInvitationPreview } from '@monkitrips/shared'
import { ApiFailure } from '../../core/api/api-failure'
import { AUTH_API } from '../../core/api/auth-api'
import { OFFLINE_DB } from '../../core/offline/db'
import { toTripRecord } from '../../core/offline/trip-record'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { provideUiI18n } from '../../shared/ui/ui-i18n'
import { AUTH_ERROR_CODES, provideAuthI18n } from './auth-i18n'

type InviteState = 'checking' | 'ready' | 'not-found' | 'expired' | 'failed'

/**
 * `/invite/:token`: the public preview (trip name and role), then "Join" for
 * someone signed in, or the way to sign up or sign in with the token kept.
 * Joining caches the trip on the device and opens it.
 */
@Component({
  selector: 'app-invite-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    MkButtonComponent,
    MkApiErrorComponent,
    MkEmptyStateComponent,
    MkSkeletonComponent,
  ],
  providers: [provideAuthI18n(), provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('checking') {
        <p class="text-sm text-ink-2">{{ 'auth.invite.checking' | transloco }}</p>
        <mk-skeleton class="mt-4" [rows]="3" data-testid="invite.loading" />
      }
      @case ('not-found') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="circle-alert"
          [title]="'auth.invite.notFoundTitle' | transloco"
          [body]="'auth.invite.notFoundBody' | transloco"
          data-testid="invite.notFound"
        />
      }
      @case ('expired') {
        <mk-empty-state
          class="rounded-lg border border-line bg-surface-1"
          icon="circle-alert"
          [title]="'auth.invite.expiredTitle' | transloco"
          [body]="'auth.invite.expiredBody' | transloco"
          data-testid="invite.expired"
        />
      }
      @case ('failed') {
        <mk-api-error [failure]="loadFailure()" scope="auth" [knownCodes]="codes" />
        <button mk-button variant="secondary" class="mt-4" type="button" (click)="load()">
          {{ 'ui.actions.retry' | transloco }}
        </button>
      }
      @case ('ready') {
        @if (preview(); as preview) {
          <h1 class="text-xl font-semibold text-ink-1">{{ 'auth.invite.title' | transloco }}</h1>
          <p class="mt-3 text-ink-1" data-testid="invite.preview">
            {{
              'auth.invite.body'
                | transloco
                  : { tripName: preview.tripName, role: 'auth.role.' + preview.role | transloco }
            }}
          </p>
          <mk-api-error
            class="mt-4"
            [failure]="failure()"
            scope="auth"
            [knownCodes]="codes"
            testId="invite.error"
          />
          @if (session.signedIn()) {
            <button
              mk-button
              class="mt-6"
              type="button"
              [loading]="busy()"
              data-testid="invite.accept"
              (click)="accept()"
            >
              {{ 'auth.invite.accept' | transloco }}
            </button>
          } @else {
            <div class="mt-6 flex flex-col gap-3">
              <a
                mk-button
                routerLink="/signup"
                [queryParams]="{ invitation: token() }"
                data-testid="invite.signup"
              >
                {{ 'auth.invite.signup' | transloco }}
              </a>
              <a
                mk-button
                variant="secondary"
                routerLink="/login"
                [queryParams]="{ returnUrl: '/invite/' + token(), invitation: token() }"
                data-testid="invite.login"
              >
                {{ 'auth.invite.login' | transloco }}
              </a>
            </div>
          }
        }
      }
    }
  `,
})
export default class InvitePage {
  /** Bound from the route parameter. */
  readonly token = input.required<string>()

  private readonly auth = inject(AUTH_API)
  private readonly db = inject(OFFLINE_DB)
  private readonly router = inject(Router)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  protected readonly session = inject(SessionStore)

  protected readonly codes = AUTH_ERROR_CODES
  protected readonly preview = signal<TripInvitationPreview | null>(null)
  protected readonly loadFailure = signal<ApiFailure | null>(null)
  protected readonly failure = signal<ApiFailure | null>(null)
  protected readonly busy = signal(false)
  protected readonly state = computed<InviteState>(() => {
    if (this.preview()) {
      return 'ready'
    }
    const failure = this.loadFailure()
    if (!failure) {
      return 'checking'
    }
    if (failure.isStatus(404)) {
      return 'not-found'
    }
    if (failure.isStatus(410)) {
      return 'expired'
    }
    return 'failed'
  })

  constructor() {
    void this.session.restore()
    effect(() => {
      this.token()
      untracked(() => void this.load())
    })
  }

  protected async load(): Promise<void> {
    this.preview.set(null)
    this.loadFailure.set(null)
    try {
      this.preview.set(await this.auth.invitationPreview(this.token()))
    } catch (error) {
      this.loadFailure.set(toFailure(error))
    }
  }

  protected async accept(): Promise<void> {
    this.busy.set(true)
    this.failure.set(null)
    try {
      const trip = await this.auth.acceptInvitation(this.token())
      await this.db.trips.put(toTripRecord(trip))
      this.toasts.show({
        message: this.transloco.translate('auth.invite.joined', { tripName: trip.name }),
      })
      await this.router.navigate(['/t', trip.id, 'today'])
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure, `/invite/${this.token()}`))) {
        this.failure.set(failure)
      }
    } finally {
      this.busy.set(false)
    }
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
