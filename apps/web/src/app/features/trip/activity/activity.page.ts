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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { CLOCK } from '../../../core/offline/clock'
import { LangStore } from '../../../core/i18n/lang.store'
import { liveSignal } from '../../../core/offline/live'
import { OFFLINE_DB } from '../../../core/offline/offline-db'
import { OnlineStore } from '../../../core/offline/online.store'
import type { ActivityRecord } from '../../../core/offline/records'
import { SessionStore } from '../../../core/session/session.store'
import { formatLocaleFor } from '../../../domain/locale'
import { relativeTime } from '../../../domain/relative-time'
import { MkApiErrorComponent } from '../../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component'
import { MkIconButtonComponent } from '../../../shared/ui/icon-button/icon-button.component'
import type { IconName } from '../../../shared/ui/icon/icon-names'
import { MkIconComponent } from '../../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../../shared/ui/list/list.component'
import { MkSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component'
import { MkTextComponent } from '../../../shared/ui/text/text.component'
import { provideUiI18n } from '../../../shared/ui/ui-i18n'
import { ACTIVITY_ERROR_CODES, provideActivityI18n } from './activity-i18n'
import { ActivityStore } from './activity.store'

/** Entities the catalogue names; anything else reads as "something". */
const NAMED_ENTITIES = new Set([
  'trip',
  'traveller',
  'stop',
  'event',
  'segment',
  'seat',
  'document',
  'task',
  'budget_category',
  'expense',
  'expense_share',
  'emergency',
  'phrase_card',
  'member',
  'invitation',
])

const ENTITY_ICONS: Record<string, IconName> = {
  trip: 'compass',
  traveller: 'user',
  member: 'users',
  invitation: 'mail',
  stop: 'map-pin',
  event: 'calendar',
  segment: 'plane',
  seat: 'ticket',
  document: 'file-text',
  task: 'check',
  budget_category: 'wallet',
  expense: 'wallet',
  expense_share: 'wallet',
  emergency: 'phone',
  phrase_card: 'languages',
}

/** How often the "3 min ago" labels are recomputed. */
const CLOCK_TICK_MS = 60_000

/**
 * Who changed what, when: the trip's activity feed, newest first. The
 * lines come from the device's cache (Dexie) and the server refills the
 * first page on open and on refresh; "load more" follows the cursor.
 * Times are relative, with days cut by the trip's zone. Field names only,
 * never values: the feed says a booking code changed, not what it is.
 */
@Component({
  selector: 'app-activity-page',
  imports: [
    TranslocoPipe,
    MkButtonComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkApiErrorComponent,
    MkEmptyStateComponent,
    MkSkeletonComponent,
    MkStackComponent,
    MkRowComponent,
    MkTextComponent,
    MkListComponent,
    MkListRowComponent,
  ],
  providers: [provideActivityI18n(), provideUiI18n(), ActivityStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <mk-row gap="2" justify="between">
        <h1 mk-text variant="title" data-testid="trip.activity.title">
          {{ 'activity.title' | transloco }}
        </h1>
        <button
          mk-icon-button
          type="button"
          [disabled]="store.refreshing() || !online.online()"
          [attr.aria-label]="'activity.refresh' | transloco"
          data-testid="trip.activity.refresh"
          (click)="refresh()"
        >
          <mk-icon name="refresh-cw" />
        </button>
      </mk-row>

      @if (store.failure(); as failure) {
        <mk-stack gap="half">
          <mk-api-error
            [failure]="failure"
            scope="activity"
            [knownCodes]="codes"
            testId="trip.activity.error"
          />
          @if (entries().length > 0) {
            <p mk-text variant="caption" tone="ink-3" data-testid="trip.activity.saved">
              {{ 'activity.saved' | transloco }}
            </p>
          }
        </mk-stack>
      }

      @if (store.refreshing() && entries().length === 0) {
        <mk-skeleton [rows]="3" />
      } @else if (entries().length === 0) {
        <mk-empty-state
          icon="activity"
          [title]="'activity.emptyTitle' | transloco"
          [body]="'activity.emptyBody' | transloco"
          data-testid="trip.activity.empty"
        >
          @if (store.failure()) {
            <button
              mkEmptyAction
              mk-button
              variant="secondary"
              type="button"
              data-testid="trip.activity.retry"
              (click)="refresh()"
            >
              {{ 'ui.actions.retry' | transloco }}
            </button>
          }
        </mk-empty-state>
      } @else {
        <mk-list data-testid="trip.activity.list">
          @for (entry of entries(); track entry.id) {
            <mk-list-row
              [icon]="iconOf(entry)"
              [title]="lineOf(entry)"
              [meta]="fieldsOf(entry)"
              [value]="whenOf(entry)"
              testId="trip.activity.item"
            />
          }
        </mk-list>
        @if (store.hasMore()) {
          <mk-row justify="center">
            <button
              mk-button
              variant="secondary"
              type="button"
              [loading]="store.loadingMore()"
              [disabled]="!online.online()"
              data-testid="trip.activity.loadMore"
              (click)="loadMore()"
            >
              {{ 'activity.loadMore' | transloco }}
            </button>
          </mk-row>
        }
      }
    </mk-stack>
  `,
})
export default class ActivityPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  protected readonly store = inject(ActivityStore)
  protected readonly online = inject(OnlineStore)
  private readonly database = inject(OFFLINE_DB)
  private readonly session = inject(SessionStore)
  private readonly transloco = inject(TranslocoService)
  private readonly lang = inject(LangStore)
  private readonly clock = inject(CLOCK)

  protected readonly codes = ACTIVITY_ERROR_CODES

  /** The trip's zone for "yesterday"; the device's until the trip row says. */
  private readonly tripZone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone)
  private readonly now = signal(this.clock())

  private readonly cached = liveSignal<ActivityRecord[]>(
    (db) => db.activity.orderBy('[tripId+createdAt]').reverse().toArray(),
    []
  )
  protected readonly entries = computed(() =>
    this.cached().filter((entry) => entry.tripId === this.tripId())
  )

  constructor() {
    effect(() => {
      const tripId = this.tripId()
      untracked(() => {
        void this.database
          .then((db) => db.trips.get(tripId))
          .then((trip) => trip?.homeTz && this.tripZone.set(trip.homeTz))
        void this.refresh()
      })
    })
    const timer = setInterval(() => this.now.set(this.clock()), CLOCK_TICK_MS)
    inject(DestroyRef).onDestroy(() => clearInterval(timer))
  }

  protected refresh(): Promise<void> {
    this.now.set(this.clock())
    return this.store.refresh(this.tripId())
  }

  protected loadMore(): Promise<void> {
    return this.store.loadMore(this.tripId())
  }

  protected iconOf(entry: ActivityRecord): IconName {
    return ENTITY_ICONS[entry.entity] ?? 'activity'
  }

  /** "Partner changed a task", "You added an expense". */
  protected lineOf(entry: ActivityRecord): string {
    const actor =
      entry.actorUserId !== null && entry.actorUserId === this.session.user()?.id
        ? this.transloco.translate('activity.you')
        : (entry.actorName ?? this.transloco.translate('activity.someone'))
    const entity = this.transloco.translate(
      `activity.entity.${NAMED_ENTITIES.has(entry.entity) ? entry.entity : 'other'}`
    )
    const action = ['created', 'updated', 'deleted'].includes(entry.action)
      ? entry.action
      : 'updated'
    return this.transloco.translate(`activity.line.${action}`, { actor, entity })
  }

  /** The field names of an update, as words ("booking code, notes"); nothing for the rest. */
  protected fieldsOf(entry: ActivityRecord): string | undefined {
    if (entry.action !== 'updated' || entry.fields.length === 0) {
      return undefined
    }
    const fields = entry.fields.map(words).join(', ')
    return this.transloco.translate('activity.fields', { fields })
  }

  protected whenOf(entry: ActivityRecord): string {
    return relativeTime({
      instant: entry.createdAt,
      now: this.now(),
      timeZone: this.tripZone(),
      locale: formatLocaleFor(this.lang.lang()),
    })
  }
}

/** `bookingCode` and `booking_code` both read as "booking code". */
function words(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
}
