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
import { form, FormField, email as emailRule, required, submit } from '@angular/forms/signals'
import { Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import type { TripInvitation, TripMember } from '@monkitrips/shared'
import { firstValueFrom } from 'rxjs'
import { ApiFailure } from '../../../core/api/api-failure'
import { TRIPS_API } from '../../../core/api/trips-api'
import { fieldError } from '../../../core/forms/field-error'
import { serverFieldErrors } from '../../../core/forms/server-errors'
import { LangStore } from '../../../core/i18n/lang.store'
import { liveSignal } from '../../../core/offline/live'
import { OFFLINE_DB } from '../../../core/offline/offline-db'
import { OnlineStore } from '../../../core/offline/online.store'
import type { TravellerRecord } from '../../../core/offline/records'
import { TravellersStore } from '../../../core/offline/travellers.store'
import { SessionStore } from '../../../core/session/session.store'
import { formatDayDate } from '../../../domain/day-date'
import { formatLocaleFor } from '../../../domain/locale'
import { calendarDateIn } from '../../../domain/relative-time'
import { MkApiErrorComponent } from '../../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../../shared/ui/button/button.component'
import { MkChipComponent } from '../../../shared/ui/chip/chip.component'
import { MkFieldComponent } from '../../../shared/ui/field/field.component'
import { MkInputDirective } from '../../../shared/ui/field/input.directive'
import { MkIconButtonComponent } from '../../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkListRowComponent, type RowStatus } from '../../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../../shared/ui/list/list.component'
import { SheetService } from '../../../shared/ui/sheet/sheet.service'
import { MkSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component'
import { MkTextComponent } from '../../../shared/ui/text/text.component'
import { ToastService } from '../../../shared/ui/toast/toast.service'
import { provideUiI18n } from '../../../shared/ui/ui-i18n'
import { MEMBERS_ERROR_CODES, provideMembersI18n } from './members-i18n'
import { TravellerSheet, type TravellerSheetData } from './traveller.sheet'

/** Invitations the owner still has a say on. */
const OPEN_INVITATION_STATES: readonly TripInvitation['state'][] = ['pending', 'expired']

/**
 * Who travels and who edits. Members (owner first) with their role; the
 * owner invites by e-mail (the API mails the token, the screen only says
 * "sent") or by link (shown exactly once, with copy and share), revokes
 * open invitations, removes members and hands the trip over; an editor can
 * leave. Travellers (people on the trip, with or without an account) live
 * on the device and change through the outbox, so they work offline.
 */
@Component({
  selector: 'app-members-page',
  imports: [
    TranslocoPipe,
    FormField,
    MkButtonComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkChipComponent,
    MkApiErrorComponent,
    MkFieldComponent,
    MkInputDirective,
    MkSkeletonComponent,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkListComponent,
    MkListRowComponent,
  ],
  providers: [provideMembersI18n(), provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      <h1 mk-text variant="title" data-testid="trip.members.title">
        {{ 'members.title' | transloco }}
      </h1>

      @if (loading()) {
        <mk-skeleton [rows]="2" />
      } @else if (loadFailure(); as failure) {
        <mk-stack gap="2" align="start">
          <mk-api-error
            [failure]="failure"
            scope="members"
            [knownCodes]="codes"
            testId="trip.members.error"
          />
          <button mk-button variant="secondary" type="button" (click)="load()">
            {{ 'ui.actions.retry' | transloco }}
          </button>
        </mk-stack>
      } @else {
        <mk-stack gap="2">
          <mk-api-error
            [failure]="actionFailure()"
            scope="members"
            [knownCodes]="codes"
            testId="trip.members.actionError"
          />
          <mk-list data-testid="trip.members.list">
            @for (member of members(); track member.id) {
              <mk-list-row
                [title]="nameOf(member)"
                [meta]="'members.joined' | transloco: { date: dayOf(member.joinedAt) }"
                testId="trip.members.item"
              >
                <ng-container ngProjectAs="[mkRowTrailing]">
                  <mk-chip
                    variant="status"
                    [icon]="member.role === 'owner' ? 'crown' : 'pencil'"
                    [attr.data-testid]="'trip.members.role'"
                    [attr.data-role]="member.role"
                  >
                    {{ 'members.role.' + member.role | transloco }}
                  </mk-chip>
                  @if (owner() && member.role !== 'owner') {
                    <button
                      mk-icon-button
                      type="button"
                      [disabled]="busy() || !online.online()"
                      [attr.aria-label]="
                        'members.actions.makeOwner' | transloco: { name: member.displayName }
                      "
                      data-testid="trip.members.makeOwner"
                      (click)="transfer(member)"
                    >
                      <mk-icon name="crown" />
                    </button>
                    <button
                      mk-icon-button
                      type="button"
                      [disabled]="busy() || !online.online()"
                      [attr.aria-label]="
                        'members.actions.remove' | transloco: { name: member.displayName }
                      "
                      data-testid="trip.members.remove"
                      (click)="remove(member)"
                    >
                      <mk-icon name="trash-2" />
                    </button>
                  }
                  @if (!owner() && member.userId === session.user()?.id) {
                    <button
                      mk-icon-button
                      type="button"
                      [disabled]="busy() || !online.online()"
                      [attr.aria-label]="'members.actions.leave' | transloco"
                      data-testid="trip.members.leave"
                      (click)="leave(member)"
                    >
                      <mk-icon name="log-out" />
                    </button>
                  }
                </ng-container>
              </mk-list-row>
            }
          </mk-list>
        </mk-stack>
      }

      @if (owner()) {
        <mk-section
          [eyebrow]="'members.invite.title' | transloco"
          data-testid="trip.members.inviteSection"
        >
          <mk-stack gap="3">
            <form novalidate (submit)="sendEmail($event)">
              <mk-stack gap="2" align="start">
                <p mk-text tone="ink-2">{{ 'members.invite.emailBody' | transloco }}</p>
                <mk-field
                  [label]="'members.invite.email' | transloco"
                  [required]="true"
                  [error]="fieldError(emailForm.email)"
                >
                  <input
                    mkInput
                    type="email"
                    autocomplete="email"
                    inputmode="email"
                    [formField]="emailForm.email"
                    data-testid="trip.members.inviteEmail"
                  />
                </mk-field>
                @if (emailSent(); as sent) {
                  <mk-row gap="half" data-testid="trip.members.emailSent">
                    <span mk-text variant="caption" tone="status-good">
                      <mk-icon name="circle-check" [size]="16" />
                    </span>
                    <span mk-text variant="caption" tone="ink-2">
                      {{ 'members.invite.sent' | transloco: { email: sent } }}
                    </span>
                  </mk-row>
                }
                <mk-api-error
                  [failure]="emailFailure()"
                  scope="members"
                  [knownCodes]="codes"
                  testId="trip.members.emailError"
                />
                <button
                  mk-button
                  variant="secondary"
                  type="submit"
                  [loading]="sendingEmail()"
                  [disabled]="!online.online()"
                  data-testid="trip.members.sendEmail"
                >
                  <mk-icon name="mail" [size]="18" />
                  {{ 'members.invite.send' | transloco }}
                </button>
              </mk-stack>
            </form>

            <mk-stack gap="2" align="start">
              <p mk-text tone="ink-2">{{ 'members.invite.linkBody' | transloco }}</p>
              @if (link(); as link) {
                <mk-stack gap="1" align="start" data-testid="trip.members.link">
                  <mk-stack gap="0">
                    <p mk-text variant="body-strong">
                      {{ 'members.invite.linkTitle' | transloco }}
                    </p>
                    <p mk-text variant="caption" tone="ink-3">
                      {{ 'members.invite.linkShown' | transloco }}
                    </p>
                  </mk-stack>
                  <code
                    mk-text
                    variant="code"
                    [breakAnywhere]="true"
                    data-testid="trip.members.linkUrl"
                    >{{ link }}</code
                  >
                  <mk-row gap="1" [wrap]="true">
                    <button
                      mk-button
                      variant="secondary"
                      type="button"
                      data-testid="trip.members.copy"
                      (click)="copy(link)"
                    >
                      <mk-icon name="copy" [size]="18" />
                      {{ 'members.invite.copy' | transloco }}
                    </button>
                    @if (canShare()) {
                      <button
                        mk-button
                        variant="secondary"
                        type="button"
                        data-testid="trip.members.share"
                        (click)="share(link)"
                      >
                        <mk-icon name="share" [size]="18" />
                        {{ 'members.invite.share' | transloco }}
                      </button>
                    }
                  </mk-row>
                </mk-stack>
              } @else {
                <mk-api-error
                  [failure]="inviteFailure()"
                  scope="members"
                  [knownCodes]="codes"
                  testId="trip.members.inviteError"
                />
                <button
                  mk-button
                  variant="secondary"
                  type="button"
                  [loading]="inviting()"
                  [disabled]="!online.online()"
                  data-testid="trip.members.inviteLink"
                  (click)="invite()"
                >
                  <mk-icon name="link" [size]="18" />
                  {{ 'members.invite.link' | transloco }}
                </button>
              }
              @if (!online.online()) {
                <p mk-text tone="ink-2" data-testid="trip.members.offline">
                  {{ 'members.invite.offline' | transloco }}
                </p>
              }
            </mk-stack>
          </mk-stack>
        </mk-section>

        <mk-section
          [eyebrow]="'members.invitations.title' | transloco"
          data-testid="trip.members.invitations"
        >
          @if (openInvitations().length === 0) {
            <p mk-text tone="ink-2" data-testid="trip.members.noInvitations">
              {{ 'members.invitations.none' | transloco }}
            </p>
          } @else {
            <mk-list>
              @for (invitation of openInvitations(); track invitation.id) {
                <mk-list-row
                  [icon]="invitation.email ? 'mail' : 'link'"
                  [title]="invitation.email ?? ('members.invitations.link' | transloco)"
                  [meta]="
                    'members.invitations.expires' | transloco: { date: dayOf(invitation.expiresAt) }
                  "
                  [status]="
                    invitation.state === 'expired'
                      ? status('serious', 'circle-alert', 'members.invitations.expired' | transloco)
                      : undefined
                  "
                  testId="trip.members.invitation"
                >
                  <ng-container ngProjectAs="[mkRowTrailing]">
                    @if (invitation.state === 'pending') {
                      <button
                        mk-icon-button
                        type="button"
                        [disabled]="busy() || !online.online()"
                        [attr.aria-label]="'members.invitations.revoke' | transloco"
                        data-testid="trip.members.revoke"
                        (click)="revoke(invitation)"
                      >
                        <mk-icon name="x" />
                      </button>
                    }
                  </ng-container>
                </mk-list-row>
              }
            </mk-list>
          }
        </mk-section>
      }

      <mk-section
        [eyebrow]="'members.travellers.title' | transloco"
        data-testid="trip.members.travellers"
      >
        <mk-stack gap="2">
          <p mk-text tone="ink-2">{{ 'members.travellers.body' | transloco }}</p>
          <mk-list data-testid="trip.members.travellersList">
            @for (traveller of travellers(); track traveller.id) {
              <mk-list-row
                [title]="traveller.displayName"
                [meta]="
                  (traveller.userId ? 'members.travellers.linked' : 'members.travellers.noAccount')
                    | transloco
                "
                [status]="
                  traveller.syncState === 'pending'
                    ? status('warning', 'clock', 'members.travellers.pending' | transloco)
                    : undefined
                "
                testId="trip.members.traveller"
              >
                <ng-container ngProjectAs="[mkRowTrailing]">
                  <button
                    mk-icon-button
                    type="button"
                    [attr.aria-label]="
                      'members.travellers.rename' | transloco: { name: traveller.displayName }
                    "
                    data-testid="trip.members.renameTraveller"
                    (click)="renameTraveller(traveller)"
                  >
                    <mk-icon name="pencil" />
                  </button>
                  @if (!traveller.userId) {
                    <button
                      mk-icon-button
                      type="button"
                      [attr.aria-label]="
                        'members.travellers.remove' | transloco: { name: traveller.displayName }
                      "
                      data-testid="trip.members.removeTraveller"
                      (click)="removeTraveller(traveller)"
                    >
                      <mk-icon name="trash-2" />
                    </button>
                  }
                </ng-container>
              </mk-list-row>
            }
          </mk-list>
          <mk-row>
            <button
              mk-button
              variant="secondary"
              type="button"
              data-testid="trip.members.addTraveller"
              (click)="addTraveller()"
            >
              <mk-icon name="user-plus" [size]="18" />
              {{ 'members.travellers.add' | transloco }}
            </button>
          </mk-row>
        </mk-stack>
      </mk-section>
    </mk-stack>
  `,
})
export default class MembersPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly api = inject(TRIPS_API)
  private readonly database = inject(OFFLINE_DB)
  private readonly travellersStore = inject(TravellersStore)
  private readonly toasts = inject(ToastService)
  private readonly sheets = inject(SheetService)
  private readonly router = inject(Router)
  private readonly transloco = inject(TranslocoService)
  private readonly lang = inject(LangStore)
  private readonly document = inject(DOCUMENT)
  protected readonly session = inject(SessionStore)
  protected readonly online = inject(OnlineStore)

  protected readonly codes = MEMBERS_ERROR_CODES
  protected readonly fieldError = fieldError

  protected readonly members = signal<TripMember[]>([])
  protected readonly invitations = signal<TripInvitation[]>([])
  protected readonly loading = signal(true)
  protected readonly loadFailure = signal<ApiFailure | null>(null)
  /** A failure of one of the row actions (transfer, remove, leave, revoke). */
  protected readonly actionFailure = signal<ApiFailure | null>(null)
  /** True while a row action is in flight: the other row buttons wait. */
  protected readonly busy = signal(false)

  protected readonly inviting = signal(false)
  protected readonly inviteFailure = signal<ApiFailure | null>(null)
  protected readonly link = signal<string | null>(null)

  protected readonly sendingEmail = signal(false)
  protected readonly emailFailure = signal<ApiFailure | null>(null)
  protected readonly emailSent = signal<string | null>(null)
  protected readonly emailModel = signal({ email: '' })
  protected readonly emailForm = form(this.emailModel, (path) => {
    required(path.email)
    emailRule(path.email)
  })

  /** The trip's zone for the dates shown; the device's until the trip row says. */
  private readonly tripZone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone)

  private readonly allTravellers = liveSignal<TravellerRecord[]>(
    (db) => db.travellers.toCollection().sortBy('position'),
    []
  )
  protected readonly travellers = computed(() =>
    this.allTravellers().filter((traveller) => traveller.tripId === this.tripId())
  )

  private readonly me = computed(() => {
    const userId = this.session.user()?.id
    return this.members().find((member) => member.userId === userId) ?? null
  })
  protected readonly owner = computed(() => this.me()?.role === 'owner')
  protected readonly openInvitations = computed(() =>
    this.invitations().filter((invitation) => OPEN_INVITATION_STATES.includes(invitation.state))
  )
  protected readonly canShare = computed(
    () => typeof this.document.defaultView?.navigator?.share === 'function'
  )

  /** A row status with its label already translated by the template. */
  protected status(tone: RowStatus['tone'], icon: RowStatus['icon'], label: string): RowStatus {
    return { tone, icon, label }
  }

  constructor() {
    effect(() => {
      this.tripId()
      untracked(() => void this.load())
    })
  }

  protected nameOf(member: TripMember): string {
    return member.userId === this.session.user()?.id
      ? `${member.displayName} (${this.transloco.translate('members.you')})`
      : member.displayName
  }

  /** A calendar day of the trip's zone, formatted in the UI language. */
  protected dayOf(instant: string): string {
    return formatDayDate(
      calendarDateIn(instant, this.tripZone()),
      formatLocaleFor(this.lang.lang()),
      false
    )
  }

  protected async load(): Promise<void> {
    this.loading.set(true)
    this.loadFailure.set(null)
    try {
      const db = await this.database
      const trip = await db.trips.get(this.tripId())
      if (trip?.homeTz) {
        this.tripZone.set(trip.homeTz)
      }
      const members = await this.api.members(this.tripId())
      this.members.set(members)
      const me = this.session.user()?.id
      const owner = members.some((member) => member.userId === me && member.role === 'owner')
      await Promise.all([owner ? this.loadInvitations() : undefined, this.refillTravellers()])
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        this.loadFailure.set(failure)
      }
    } finally {
      this.loading.set(false)
    }
  }

  private async loadInvitations(): Promise<void> {
    this.invitations.set(await this.api.invitations(this.tripId()))
  }

  /** The server's travellers refresh the device's copy; without an answer the copy stands. */
  private async refillTravellers(): Promise<void> {
    if (!this.online.online()) {
      return
    }
    try {
      const snapshot = await this.api.snapshot(this.tripId())
      if (snapshot) {
        await this.travellersStore.refill(this.tripId(), snapshot.travellers)
      }
    } catch {
      // The device's travellers stand; the members list already said what failed.
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
      this.invitations.update((rows) => [issued.invitation, ...rows])
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        this.inviteFailure.set(failure)
      }
    } finally {
      this.inviting.set(false)
    }
  }

  protected async sendEmail(event: Event): Promise<void> {
    event.preventDefault()
    this.emailFailure.set(null)
    this.emailSent.set(null)
    await submit(this.emailForm, async () => {
      this.sendingEmail.set(true)
      const email = this.emailModel().email.trim()
      try {
        const issued = await this.api.inviteByEmail(this.tripId(), { email, role: 'editor' })
        this.invitations.update((rows) => [issued.invitation, ...rows])
        this.emailSent.set(email)
        return undefined
      } catch (error) {
        const failure = toFailure(error)
        if (await this.session.handleUnauthorized(failure)) {
          return undefined
        }
        this.emailFailure.set(failure)
        return serverFieldErrors(failure, this.emailForm)
      } finally {
        this.sendingEmail.set(false)
      }
    })
  }

  protected async copy(link: string): Promise<void> {
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(link)
      this.toasts.show({ message: this.transloco.translate('members.invite.copied') })
    } catch {
      // No clipboard (http, permissions): the link stays on screen to select by hand.
    }
  }

  protected async share(link: string): Promise<void> {
    try {
      await this.document.defaultView?.navigator.share({ url: link })
    } catch {
      // The person closed the share sheet, or the browser refused: the link stays on screen.
    }
  }

  protected async transfer(member: TripMember): Promise<void> {
    const name = member.displayName
    const confirmed = await this.sheets.confirm({
      title: this.transloco.translate('members.transfer.title'),
      body: this.transloco.translate('members.transfer.body', { name }),
      confirmLabel: this.transloco.translate('members.transfer.confirm', { name }),
    })
    if (!confirmed) {
      return
    }
    await this.act(async () => {
      this.members.set(await this.api.transferOwnership(this.tripId(), member.userId))
      this.toasts.show({ message: this.transloco.translate('members.transfer.done', { name }) })
    })
  }

  protected async remove(member: TripMember): Promise<void> {
    const name = member.displayName
    const confirmed = await this.sheets.confirm({
      title: this.transloco.translate('members.remove.title'),
      body: this.transloco.translate('members.remove.body', { name }),
      confirmLabel: this.transloco.translate('members.remove.confirm'),
      destructive: true,
    })
    if (!confirmed) {
      return
    }
    await this.act(async () => {
      await this.api.removeMember(this.tripId(), member.id)
      this.members.update((rows) => rows.filter((row) => row.id !== member.id))
      this.toasts.show({ message: this.transloco.translate('members.remove.done', { name }) })
    })
  }

  protected async leave(member: TripMember): Promise<void> {
    const confirmed = await this.sheets.confirm({
      title: this.transloco.translate('members.leave.title'),
      body: this.transloco.translate('members.leave.body'),
      confirmLabel: this.transloco.translate('members.leave.confirm'),
      destructive: true,
    })
    if (!confirmed) {
      return
    }
    await this.act(async () => {
      await this.api.removeMember(this.tripId(), member.id)
      await this.forgetTrip()
      this.toasts.show({ message: this.transloco.translate('members.leave.done') })
      await this.router.navigate(['/trips'])
    })
  }

  protected async revoke(invitation: TripInvitation): Promise<void> {
    const confirmed = await this.sheets.confirm({
      title: this.transloco.translate('members.invitations.revokeTitle'),
      body: this.transloco.translate('members.invitations.revokeBody'),
      confirmLabel: this.transloco.translate('members.invitations.revokeConfirm'),
      destructive: true,
    })
    if (!confirmed) {
      return
    }
    await this.act(async () => {
      await this.api.revokeInvitation(this.tripId(), invitation.id)
      this.invitations.update((rows) =>
        rows.map((row) => (row.id === invitation.id ? { ...row, state: 'revoked' } : row))
      )
      this.toasts.show({ message: this.transloco.translate('members.invitations.revoked') })
    })
  }

  protected async addTraveller(): Promise<void> {
    const name = await this.askName('members.travellers.addTitle', '')
    if (!name) {
      return
    }
    await this.travellersStore.add(this.tripId(), name)
    this.toasts.show({ message: this.transloco.translate('members.travellers.added', { name }) })
  }

  protected async renameTraveller(traveller: TravellerRecord): Promise<void> {
    const name = await this.askName('members.travellers.renameTitle', traveller.displayName)
    if (!name || name === traveller.displayName) {
      return
    }
    await this.travellersStore.rename(traveller.id, name)
  }

  protected async removeTraveller(traveller: TravellerRecord): Promise<void> {
    const name = traveller.displayName
    const confirmed = await this.sheets.confirm({
      title: this.transloco.translate('members.travellers.removeTitle'),
      body: this.transloco.translate('members.travellers.removeBody', { name }),
      confirmLabel: this.transloco.translate('members.travellers.removeConfirm'),
      destructive: true,
    })
    if (!confirmed) {
      return
    }
    await this.travellersStore.remove(traveller.id)
    this.toasts.show({ message: this.transloco.translate('members.travellers.removed', { name }) })
  }

  private async askName(titleKey: string, name: string): Promise<string | undefined> {
    const ref = this.sheets.open<string | undefined, TravellerSheetData>(TravellerSheet, {
      data: { titleKey, name },
      label: this.transloco.translate(titleKey),
    })
    const answer = await firstValueFrom(ref.closed)
    return answer?.trim() || undefined
  }

  /** Runs one row action: a 401 ends the session, any other failure shows above the list. */
  private async act(work: () => Promise<void>): Promise<void> {
    this.busy.set(true)
    this.actionFailure.set(null)
    try {
      await work()
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        this.actionFailure.set(failure)
      }
    } finally {
      this.busy.set(false)
    }
  }

  /** After leaving: the trip and what the device holds of it go. */
  private async forgetTrip(): Promise<void> {
    const tripId = this.tripId()
    const db = await this.database
    await db.transaction('rw', [db.trips, db.travellers, db.activity], async () => {
      await db.trips.delete(tripId)
      await db.travellers.where('tripId').equals(tripId).delete()
      await db.activity.where('tripId').equals(tripId).delete()
    })
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
