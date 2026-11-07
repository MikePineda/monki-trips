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
import { TRIP_ERROR_CODES } from '../../layouts/shell/shell-i18n'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'

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
    MkStackComponent,
    MkSectionComponent,
    MkTextComponent,
    MkListComponent,
    MkListRowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <h1 mk-text variant="title" data-testid="trip.members.title">
        {{ 'shell.trip.members.title' | transloco }}
      </h1>
      @if (loading()) {
        <mk-skeleton [rows]="2" />
      } @else if (loadFailure(); as failure) {
        <mk-api-error [failure]="failure" scope="shell" [knownCodes]="codes" />
      } @else {
        <mk-list data-testid="trip.members.list">
          @for (member of members(); track member.id) {
            <mk-list-row
              [title]="
                member.userId === session.user()?.id
                  ? member.displayName + ' (' + ('shell.trip.members.you' | transloco) + ')'
                  : member.displayName
              "
              [value]="'shell.trip.members.role.' + member.role | transloco"
              testId="trip.members.item"
            />
          }
        </mk-list>
      }
      @if (owner()) {
        <mk-section
          [eyebrow]="'shell.trip.members.invite' | transloco"
          data-testid="trip.members.inviteSection"
        >
          <mk-stack gap="2" align="start">
            <p mk-text tone="ink-2">{{ 'shell.trip.members.inviteBody' | transloco }}</p>
            @if (link(); as link) {
              <mk-stack gap="1" align="start" data-testid="trip.members.link">
                <mk-stack gap="0">
                  <p mk-text variant="body-strong">
                    {{ 'shell.trip.members.linkTitle' | transloco }}
                  </p>
                  <p mk-text variant="caption" tone="ink-3">
                    {{ 'shell.trip.members.linkBody' | transloco }}
                  </p>
                </mk-stack>
                <code
                  mk-text
                  variant="code"
                  [breakAnywhere]="true"
                  data-testid="trip.members.linkUrl"
                  >{{ link }}</code
                >
                <button
                  mk-button
                  variant="secondary"
                  type="button"
                  data-testid="trip.members.copy"
                  (click)="copy(link)"
                >
                  <mk-icon name="share" [size]="18" />
                  {{ 'shell.trip.members.copy' | transloco }}
                </button>
              </mk-stack>
            } @else {
              <mk-api-error
                [failure]="inviteFailure()"
                scope="shell"
                [knownCodes]="codes"
                testId="trip.members.inviteError"
              />
              @if (!online.online()) {
                <p mk-text tone="ink-2">{{ 'shell.trip.members.offline' | transloco }}</p>
              }
              <button
                mk-button
                type="button"
                [loading]="inviting()"
                [disabled]="!online.online()"
                data-testid="trip.members.inviteLink"
                (click)="invite()"
              >
                {{ 'shell.trip.members.invite' | transloco }}
              </button>
            }
          </mk-stack>
        </mk-section>
      }
    </mk-stack>
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
