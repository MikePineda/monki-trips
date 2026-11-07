import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import type { TripMember } from '@monkitrips/shared'
import { ApiFailure } from '../../core/api/api-failure'
import { TRIPS_API } from '../../core/api/trips-api'
import { OnlineStore } from '../../core/offline/online.store'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { TRIP_ERROR_CODES } from '../../layouts/shell/shell-i18n'

/**
 * The trip's members (owner first) and, for the owner, an invitation by
 * link: the API shows the link exactly once, so the page keeps it on screen
 * with a copy button until the person leaves.
 */
@Component({
  selector: 'app-members-page',
  imports: [
    TranslocoPipe,
    MkButtonComponent,
    MkIconComponent,
    MkApiErrorComponent,
    MkSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1" data-testid="trip.members.title">
      {{ 'shell.trip.members.title' | transloco }}
    </h1>
    @if (loading()) {
      <mk-skeleton class="mt-4" [rows]="2" />
    } @else if (loadFailure(); as failure) {
      <mk-api-error class="mt-4" [failure]="failure" scope="shell" [knownCodes]="codes" />
    } @else {
      <ul class="mt-4 divide-y divide-line" data-testid="trip.members.list">
        @for (member of members(); track member.id) {
          <li class="flex items-center gap-3 py-3" data-testid="trip.members.item">
            <span class="min-w-0 flex-1 truncate font-medium text-ink-1">
              {{ member.displayName }}
              @if (member.userId === session.user()?.id) {
                <span class="text-ink-3">({{ 'shell.trip.members.you' | transloco }})</span>
              }
            </span>
            <span class="text-sm text-ink-2">{{
              'shell.trip.members.role.' + member.role | transloco
            }}</span>
          </li>
        }
      </ul>
    }
    @if (owner()) {
      <section class="mt-8" data-testid="trip.members.inviteSection">
        <h2 class="text-sm font-medium text-ink-2">
          {{ 'shell.trip.members.invite' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-ink-2">{{ 'shell.trip.members.inviteBody' | transloco }}</p>
        @if (link(); as link) {
          <div
            class="mt-3 rounded-lg border border-line bg-surface-1 p-3"
            data-testid="trip.members.link"
          >
            <p class="text-sm font-medium text-ink-1">
              {{ 'shell.trip.members.linkTitle' | transloco }}
            </p>
            <p class="mt-1 text-xs text-ink-3">{{ 'shell.trip.members.linkBody' | transloco }}</p>
            <code
              class="mt-2 block break-all font-mono text-sm text-ink-1"
              data-testid="trip.members.linkUrl"
              >{{ link }}</code
            >
            <button
              mk-button
              variant="secondary"
              type="button"
              class="mt-3"
              data-testid="trip.members.copy"
              (click)="copy(link)"
            >
              <mk-icon name="share" [size]="18" />
              {{ 'shell.trip.members.copy' | transloco }}
            </button>
          </div>
        } @else {
          <mk-api-error
            class="mt-3"
            [failure]="inviteFailure()"
            scope="shell"
            [knownCodes]="codes"
            testId="trip.members.inviteError"
          />
          @if (!online.online()) {
            <p class="mt-3 text-sm text-ink-2">{{ 'shell.trip.members.offline' | transloco }}</p>
          }
          <button
            mk-button
            type="button"
            class="mt-3"
            [loading]="inviting()"
            [disabled]="!online.online()"
            data-testid="trip.members.inviteLink"
            (click)="invite()"
          >
            {{ 'shell.trip.members.invite' | transloco }}
          </button>
        }
      </section>
    }
  `,
})
export default class MembersPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly api = inject(TRIPS_API)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly document = inject(DOCUMENT)
  protected readonly session = inject(SessionStore)
  protected readonly online = inject(OnlineStore)

  protected readonly codes = TRIP_ERROR_CODES
  protected readonly members = signal<TripMember[]>([])
  protected readonly loading = signal(true)
  protected readonly loadFailure = signal<ApiFailure | null>(null)
  protected readonly inviting = signal(false)
  protected readonly inviteFailure = signal<ApiFailure | null>(null)
  protected readonly link = signal<string | null>(null)
  protected readonly owner = computed(() => {
    const me = this.session.user()?.id
    return this.members().some((member) => member.userId === me && member.role === 'owner')
  })

  constructor() {
    effect(() => {
      this.tripId()
      untracked(() => void this.load())
    })
  }

  protected async load(): Promise<void> {
    this.loading.set(true)
    this.loadFailure.set(null)
    try {
      this.members.set(await this.api.members(this.tripId()))
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        this.loadFailure.set(failure)
      }
    } finally {
      this.loading.set(false)
    }
  }

  protected async invite(): Promise<void> {
    this.inviting.set(true)
    this.inviteFailure.set(null)
    try {
      const issued = await this.api.inviteByLink(this.tripId())
      if (issued.delivery === 'link') {
        this.link.set(issued.url)
      }
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        this.inviteFailure.set(failure)
      }
    } finally {
      this.inviting.set(false)
    }
  }

  protected async copy(link: string): Promise<void> {
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(link)
      this.toasts.show({ message: this.transloco.translate('shell.trip.members.copied') })
    } catch {
      // No clipboard (http, permissions): the link stays on screen to select by hand.
    }
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
