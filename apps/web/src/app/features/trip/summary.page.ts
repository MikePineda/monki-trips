import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { nightCoverage, routeChips, tripSummary } from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { CLOCK } from '../../core/offline/clock'
import { TIME_ZONE } from '../../core/offline/time-zone'
import type { StopRecord } from '../../core/offline/records'
import {
  tripEvents,
  tripMembers,
  tripRecord,
  tripSegments,
  tripStops,
} from '../../core/offline/trip-queries'
import { SessionStore } from '../../core/session/session.store'
import { countKey } from '../../domain/count-key'
import { formatDayDate } from '../../domain/day-date'
import { toDomainEvents } from '../../domain/event-instants'
import { localToday } from '../../domain/local-today'
import { tripRole } from '../../domain/trip-role'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkRouteChipComponent } from '../../shared/ui/route-chip/route-chip.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { EditTripSheet, type EditTripData } from './edit-trip.sheet'
import { StopSheet, type StopSheetData } from './stop.sheet'
import { provideTripI18n } from './trip-i18n'

/**
 * The trip at a glance, read from the device: dates, days, nights and
 * countries, the route as chips, the nights still without a place to
 * sleep, and the stops (the places you stay in, in order), each editable
 * in a sheet. The default screen of a trip that is not ongoing.
 */
@Component({
  selector: 'app-summary-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkButtonComponent,
    MkIconComponent,
    MkIconButtonComponent,
    MkBannerComponent,
    MkRouteChipComponent,
    MkListComponent,
    MkListRowComponent,
    MkEmptyStateComponent,
  ],
  providers: [provideTripI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <mk-row gap="2" justify="between" align="start">
        <mk-stack gap="half">
          <h1 mk-text variant="title" data-testid="trip.summary.title">
            {{ 'trip.summary.title' | transloco }}
          </h1>
          @if (trip(); as trip) {
            <p mk-text tone="ink-2" data-testid="trip.summary.dates">
              {{
                'trip.summary.dates'
                  | transloco: { start: day(trip.startDate), end: day(trip.endDate) }
              }}
            </p>
            <p mk-text variant="caption" tone="ink-3" data-testid="trip.summary.stats">
              {{ countKey('days', counts().days) | transloco: { count: counts().days } }} ·
              {{ countKey('nights', counts().nights) | transloco: { count: counts().nights } }} ·
              {{
                countKey('countries', counts().countries) | transloco: { count: counts().countries }
              }}
            </p>
            <p mk-text variant="label" tone="ink-2" data-testid="trip.summary.phase">
              {{ phaseKey() | transloco: phaseParams() }}
            </p>
          }
        </mk-stack>
        <button
          mk-button
          variant="secondary"
          size="sm"
          type="button"
          data-testid="trip.summary.edit"
          (click)="editTrip()"
        >
          <mk-icon name="pencil" [size]="18" />
          {{ 'trip.summary.edit' | transloco }}
        </button>
      </mk-row>

      @if (uncovered() > 0) {
        <mk-banner
          tone="serious"
          role="alert"
          icon="octagon-alert"
          [title]="uncoveredKey() | transloco: { count: uncovered() }"
          [body]="'trip.summary.alerts.uncoveredBody' | transloco"
          data-testid="trip.summary.uncovered"
        >
          <a
            mkBannerAction
            mk-button
            variant="ghost"
            size="sm"
            [routerLink]="['/t', tripId(), 'plan', 'nights']"
            data-testid="trip.summary.whereWeSleep"
          >
            {{ 'trip.summary.alerts.whereWeSleep' | transloco }}
          </a>
        </mk-banner>
      }

      <mk-section [eyebrow]="'trip.summary.route' | transloco">
        @if (chips().length > 0) {
          <mk-row gap="1" [wrap]="true" data-testid="trip.summary.route">
            <mk-route-chip [stops]="chips()" size="display" />
          </mk-row>
        } @else {
          <p mk-text variant="caption" tone="ink-3">{{ 'trip.summary.noRoute' | transloco }}</p>
        }
      </mk-section>

      <mk-section [eyebrow]="'trip.summary.stops.title' | transloco">
        <mk-stack gap="1">
          @if (stops().length === 0) {
            <mk-empty-state
              layout="compact"
              icon="map-pin"
              [title]="'trip.summary.stops.emptyTitle' | transloco"
              [body]="'trip.summary.stops.emptyBody' | transloco"
              data-testid="trip.summary.noStops"
            >
              <button
                mkEmptyAction
                mk-button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="trip.summary.addStop"
                (click)="editStop()"
              >
                {{ 'trip.summary.stops.add' | transloco }}
              </button>
            </mk-empty-state>
          } @else {
            <mk-list data-testid="trip.summary.stops">
              @for (stop of stops(); track stop.id) {
                <mk-list-row
                  icon="map-pin"
                  [title]="stop.name"
                  [meta]="stopMeta(stop)"
                  [value]="stop.countryCode ?? ''"
                  testId="trip.summary.stop"
                >
                  <button
                    mkRowTrailing
                    mk-icon-button
                    type="button"
                    [attr.aria-label]="'trip.stop.editTitle' | transloco"
                    data-testid="trip.summary.editStop"
                    (click)="editStop(stop)"
                  >
                    <mk-icon name="pencil" />
                  </button>
                </mk-list-row>
              }
            </mk-list>
            <mk-row justify="end">
              <button
                mk-button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="trip.summary.addStop"
                (click)="editStop()"
              >
                <mk-icon name="plus" [size]="18" />
                {{ 'trip.summary.stops.add' | transloco }}
              </button>
            </mk-row>
          }
        </mk-stack>
      </mk-section>
    </mk-stack>
  `,
})
export default class SummaryPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly sheets = inject(SheetService)
  private readonly session = inject(SessionStore)
  private readonly clock = inject(CLOCK)
  private readonly zone = inject(TIME_ZONE)
  private readonly locale = intlLocale()

  protected readonly trip = tripRecord(this.tripId)
  private readonly rawStops = tripStops(this.tripId)
  private readonly events = tripEvents(this.tripId)
  private readonly segments = tripSegments(this.tripId)
  private readonly members = tripMembers(this.tripId)

  protected readonly stops = computed(() =>
    [...this.rawStops()].sort(
      (a, b) =>
        a.position - b.position ||
        (a.arriveOn ?? '').localeCompare(b.arriveOn ?? '') ||
        a.name.localeCompare(b.name)
    )
  )
  protected readonly chips = computed(() => routeChips(this.stops()).map((chip) => chip.label))

  private readonly summary = computed(() => {
    const trip = this.trip()
    if (!trip) {
      return null
    }
    return tripSummary(
      { startsOn: trip.startDate, endsOn: trip.endDate },
      this.stops(),
      localToday(this.clock(), this.zone)
    )
  })

  protected readonly counts = computed(() => {
    const summary = this.summary()
    return {
      days: summary?.totalDays ?? 0,
      nights: summary?.nights ?? 0,
      countries: summary?.countryCount ?? 0,
    }
  })

  protected readonly phaseKey = computed(() => {
    const summary = this.summary()
    if (!summary) {
      return 'trip.summary.phase.ongoing'
    }
    if (summary.phase === 'upcoming') {
      return `trip.summary.phase.${countKey('upcoming', summary.daysUntilStart ?? 0)}`
    }
    if (summary.phase === 'past') {
      return `trip.summary.phase.${countKey('past', summary.daysSinceEnd ?? 0)}`
    }
    return 'trip.summary.phase.ongoing'
  })

  protected readonly phaseParams = computed(() => {
    const summary = this.summary()
    if (!summary) {
      return {}
    }
    return {
      count: summary.daysUntilStart ?? summary.daysSinceEnd ?? 0,
      day: summary.dayNumber ?? 0,
      total: summary.totalDays,
    }
  })

  protected readonly uncovered = computed(() => {
    const trip = this.trip()
    if (!trip) {
      return 0
    }
    return nightCoverage(
      { startsOn: trip.startDate, endsOn: trip.endDate },
      toDomainEvents(this.events(), this.segments())
    ).uncovered.length
  })
  protected readonly uncoveredKey = computed(
    () => `trip.summary.alerts.${countKey('uncovered', this.uncovered())}`
  )

  private readonly role = computed(() =>
    tripRole(this.members(), this.session.user()?.id, this.trip()?.role)
  )

  protected day(isoDate: string): string {
    return formatDayDate(isoDate, this.locale())
  }

  protected stopMeta(stop: StopRecord): string {
    return stop.arriveOn && stop.departOn
      ? `${this.day(stop.arriveOn)} → ${this.day(stop.departOn)}`
      : ''
  }

  protected editTrip(): void {
    const trip = this.trip()
    if (!trip) {
      return
    }
    this.sheets.open<void, EditTripData>(EditTripSheet, {
      data: { trip, role: this.role() },
    })
  }

  protected editStop(stop?: StopRecord): void {
    const trip = this.trip()
    if (!trip) {
      return
    }
    this.sheets.open<void, StopSheetData>(StopSheet, {
      data: {
        tripId: trip.id,
        stop,
        defaultTz: stop?.tz ?? this.stops().at(-1)?.tz ?? trip.homeTz ?? 'UTC',
        nextPosition: (this.stops().at(-1)?.position ?? -1) + 1,
      },
    })
  }

  protected countKey(base: 'days' | 'nights' | 'countries', count: number): string {
    return `trip.summary.${countKey(base, count)}`
  }
}
