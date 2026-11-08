import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import {
  celebratedTrip,
  daysBetween,
  historyGroups,
  passportStamps,
  type Trip,
  type TripPhase,
} from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { CLOCK } from '../../core/offline/clock'
import { MetaStore } from '../../core/offline/meta.store'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { travelRecords } from '../../core/offline/travel-records'
import { SessionStore } from '../../core/session/session.store'
import { countKey } from '../../domain/count-key'
import { formatDateRange } from '../../domain/date-range'
import { localToday } from '../../domain/local-today'
import { formatMonthYear } from '../../domain/month-year'
import { formatMoney } from '../../domain/money'
import { regionName } from '../../domain/region-name'
import { historyEntries, passportInput, type HistoryEntry } from '../../domain/travel-history'
import { TRIP_ERROR_CODES } from '../../layouts/shell/shell-i18n'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkMascotComponent } from '../../shared/ui/mascot/mascot.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { stampArtworkName } from '../../shared/ui/stamp/stamp-artwork'
import { MkStampComponent } from '../../shared/ui/stamp/stamp.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { MkTripTicketComponent } from '../../shared/ui/trip-ticket/trip-ticket.component'
import { CreateTripSheet } from './create-trip.sheet'
import { provideHistoryI18n } from './history-i18n'
import { TripsStore } from './trips.store'

/** Ongoing first (it is today), then what comes next, then the history. */
const PHASE_ORDER: readonly TripPhase[] = ['ongoing', 'upcoming', 'past']

/** Past trips that ended this recently say "Back N days ago"; older ones show their month. */
const RECENT_DAYS = 30

/** The newly earned stamps shown with Kiko at most. */
const NEW_STAMPS_SHOWN = 6

interface NewStamp {
  key: string
  code: string
  name: string
  date: string
}

/**
 * The trip list as a travel history, read from the device at once and
 * refreshed from `GET /trips` when online: the trips on the road, the ones
 * coming up and the ones we are back from, each as a ticket (route, days ·
 * nights · countries, dates, total spent in the base currency, its cover
 * stamp). For a week after a trip ends Kiko celebrates at the top with the
 * stamps it earned; they stamp themselves in the first time only. The
 * passport is one tap away. Empty = an honest empty state with the one
 * action that exists: create the first trip.
 */
@Component({
  selector: 'app-trips-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    MkEmptyStateComponent,
    MkIconComponent,
    MkButtonComponent,
    MkApiErrorComponent,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkBannerComponent,
    MkMascotComponent,
    MkStampComponent,
    MkTripTicketComponent,
  ],
  providers: [provideHistoryI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <mk-row gap="1" justify="between" [wrap]="true">
        <h1 mk-text variant="title">{{ 'shell.trips.title' | transloco }}</h1>
        <mk-row gap="1">
          <a
            mk-button
            variant="secondary"
            size="sm"
            routerLink="/passport"
            data-testid="trips.passport"
          >
            <mk-icon name="stamp" [size]="18" />
            {{ 'history.passport' | transloco }}
          </a>
          @if (entries().length > 0) {
            <button
              mk-button
              variant="secondary"
              size="sm"
              type="button"
              data-testid="trips.create"
              (click)="createTrip()"
            >
              <mk-icon name="plus" [size]="18" />
              {{ 'shell.trips.create.action' | transloco }}
            </button>
          }
        </mk-row>
      </mk-row>
      @if (unverified()) {
        <mk-banner
          icon="circle-alert"
          [title]="'shell.trips.unverified' | transloco"
          data-testid="trips.unverified"
        >
          <a
            mkBannerAction
            mk-button
            variant="ghost"
            size="sm"
            routerLink="/verify-email"
            data-testid="trips.verify"
          >
            {{ 'shell.trips.verify' | transloco }}
          </a>
        </mk-banner>
      } @else if (store.failure(); as failure) {
        <mk-api-error [failure]="failure" scope="shell" [knownCodes]="codes" testId="trips.error" />
      }

      @if (celebration(); as party) {
        <mk-section [hairline]="false" data-testid="history.celebration">
          <mk-stack gap="1">
            <mk-row gap="2">
              <mk-mascot
                state="celebrating"
                size="md"
                [label]="'history.celebration.mascot' | transloco"
              />
              <mk-stack gap="half">
                <h2 mk-text variant="heading">{{ 'history.celebration.title' | transloco }}</h2>
                <p mk-text variant="caption" tone="ink-2">
                  {{ 'history.celebration.body' | transloco: { trip: party.trip } }}
                </p>
              </mk-stack>
            </mk-row>
            <mk-row gap="1" [wrap]="true">
              @for (stamp of party.stamps; track stamp.key) {
                <mk-stamp
                  size="sm"
                  [code]="stamp.code"
                  [name]="stamp.name"
                  [isoDate]="stamp.date"
                  [animate]="animateNew()"
                  data-testid="history.newStamp"
                />
              }
            </mk-row>
            <mk-row justify="end">
              <a
                mk-button
                variant="ghost"
                size="sm"
                routerLink="/passport"
                data-testid="history.openPassport"
              >
                {{ 'history.celebration.open' | transloco }}
              </a>
            </mk-row>
          </mk-stack>
        </mk-section>
      }

      @if (entries().length === 0) {
        <mk-empty-state
          mascot="excited"
          [title]="'shell.trips.emptyTitle' | transloco"
          [body]="'shell.trips.emptyBody' | transloco"
          data-testid="trips.empty"
        >
          @if (!unverified()) {
            <button
              mkEmptyAction
              mk-button
              type="button"
              data-testid="trips.create"
              (click)="createTrip()"
            >
              {{ 'shell.trips.create.first' | transloco }}
            </button>
          }
        </mk-empty-state>
      } @else {
        <mk-stack gap="2" data-testid="trips.list">
          @for (group of groups(); track group.phase) {
            <mk-section
              [eyebrow]="'history.sections.' + group.phase | transloco"
              [attr.data-testid]="'history.' + group.phase"
            >
              <mk-stack gap="1">
                @for (entry of group.entries; track entry.id) {
                  <a
                    mk-trip-ticket
                    [routerLink]="['/t', entry.id, 'today']"
                    [title]="entry.name"
                    [eyebrow]="eyebrow(entry).key | transloco: eyebrow(entry).params"
                    [route]="entry.route"
                    [stats]="
                      (countKey('history.stats.days', entry.days)
                        | transloco: { count: entry.days }) +
                      ' · ' +
                      (countKey('history.stats.nights', entry.nights)
                        | transloco: { count: entry.nights }) +
                      ' · ' +
                      (countKey('history.stats.countries', entry.countries.length)
                        | transloco: { count: entry.countries.length })
                    "
                    [dates]="dates(entry)"
                    [amount]="amount(entry)"
                    data-testid="trips.item"
                  >
                    @if (entry.cover; as cover) {
                      <mk-stamp
                        mkTicketStamp
                        size="sm"
                        [code]="cover.code"
                        [name]="cover.name"
                        [isoDate]="cover.date"
                        [reached]="entry.phase !== 'upcoming'"
                        [label]="'history.cover' | transloco: { place: cover.name }"
                        data-testid="trips.item.stamp"
                      />
                    } @else {
                      <mk-icon mkTicketStamp name="map-pin" [size]="24" />
                    }
                  </a>
                }
              </mk-stack>
            </mk-section>
          }
          @if (!hasPast()) {
            <mk-empty-state
              layout="compact"
              mascot="asleep"
              mascotSize="sm"
              [title]="'history.empty.pastTitle' | transloco"
              [body]="'history.empty.pastBody' | transloco"
              data-testid="history.noPast"
            />
          }
        </mk-stack>
      }
    </mk-stack>
  `,
})
export default class TripsPage {
  protected readonly store = inject(TripsStore)
  private readonly session = inject(SessionStore)
  private readonly sheets = inject(SheetService)
  private readonly router = inject(Router)
  private readonly meta = inject(MetaStore)
  private readonly clock = inject(CLOCK)
  private readonly zone = inject(TIME_ZONE)
  private readonly locale = intlLocale()
  private readonly records = travelRecords()

  protected readonly codes = TRIP_ERROR_CODES
  protected readonly countKey = countKey
  /** The server refused the list because the address is not verified yet. */
  protected readonly unverified = computed(
    () => this.store.failure()?.is('E_EMAIL_NOT_VERIFIED') === true || !this.session.emailVerified()
  )

  private readonly today = computed(() => {
    this.records()
    return localToday(this.clock(), this.zone)
  })

  /** The trips come from the list's own read (first to answer); their content from the device. */
  private readonly content = computed(() => ({ ...this.records(), trips: this.store.trips() }))

  protected readonly entries = computed(() =>
    historyEntries({ ...this.content(), today: this.today() })
  )

  protected readonly groups = computed(() => {
    const grouped = historyGroups(this.entries(), this.today())
    return PHASE_ORDER.filter((phase) => grouped[phase].length > 0).map((phase) => ({
      phase,
      entries: grouped[phase],
    }))
  })
  protected readonly hasPast = computed(() => this.groups().some((group) => group.phase === 'past'))

  /** The trip Kiko celebrates and the stamps it earned first. */
  protected readonly celebration = computed(() => {
    const trip = celebratedTrip(this.entries(), this.today())
    if (!trip) {
      return null
    }
    const countries = passportStamps(passportInput({ ...this.content(), today: this.today() }))
    const stamps: NewStamp[] = []
    for (const country of countries) {
      if (country.earned && country.tripId === trip.id) {
        stamps.push({
          key: `country:${country.code}`,
          code: country.code,
          name: regionName(country.code, this.locale(), stampArtworkName(country.code)),
          date: country.date,
        })
      }
      for (const city of country.cities) {
        if (city.earned && city.tripId === trip.id) {
          stamps.push({
            key: `city:${country.code}:${city.name}`,
            code: `${country.code}-${city.name}`,
            name: city.name,
            date: city.date,
          })
        }
      }
    }
    return { id: trip.id, trip: trip.name, stamps: stamps.slice(0, NEW_STAMPS_SHOWN) }
  })

  /** True the first time this device shows a trip's new stamps. */
  protected readonly animateNew = signal(false)

  constructor() {
    void this.store.refresh()
    effect(() => {
      const id = this.celebration()?.id
      if (id) {
        untracked(() => void this.markSeen(id))
      }
    })
  }

  private async markSeen(tripId: string): Promise<void> {
    const key = `history.stampsSeen.${tripId}`
    if (await this.meta.get<boolean>(key)) {
      return
    }
    this.animateNew.set(true)
    await this.meta.set(key, true)
  }

  /** Where the trip stands, as a catalogue key and its parameters. */
  protected eyebrow(entry: HistoryEntry): { key: string; params: Record<string, unknown> } {
    const today = this.today()
    switch (entry.phase) {
      case 'ongoing':
        return {
          key: 'history.eyebrow.ongoing',
          params: { day: daysBetween(entry.startsOn, today) + 1, total: entry.days },
        }
      case 'upcoming': {
        const count = daysBetween(today, entry.startsOn)
        return { key: countKey('history.eyebrow.upcoming', count), params: { count } }
      }
      case 'past': {
        const count = daysBetween(entry.endsOn, today)
        return count <= RECENT_DAYS
          ? { key: countKey('history.eyebrow.past', count), params: { count } }
          : {
              key: 'history.eyebrow.pastLong',
              params: { date: formatMonthYear(entry.startsOn, this.locale()) },
            }
      }
    }
  }

  /** "27 Oct – 5 Nov 2026", in the app's language. */
  protected dates(entry: HistoryEntry): string {
    return formatDateRange(entry.startsOn, entry.endsOn, this.locale())
  }

  protected amount(entry: HistoryEntry): string | undefined {
    return entry.spentMinor > 0
      ? formatMoney(entry.spentMinor, entry.currency, this.locale())
      : undefined
  }

  protected createTrip(): void {
    const ref = this.sheets.open<Trip | undefined>(CreateTripSheet)
    ref.closed.subscribe((trip) => {
      if (trip) {
        void this.router.navigate(['/t', trip.id, 'today'])
      }
    })
  }
}
