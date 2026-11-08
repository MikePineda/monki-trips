import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import {
  balances,
  passportStamps,
  routeChips,
  sortedStops,
  tripRecap,
  type ArrivalMode,
  type TripRecap,
} from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { CLOCK } from '../../core/offline/clock'
import { OnlineStore } from '../../core/offline/online.store'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { travelRecords } from '../../core/offline/travel-records'
import {
  tripBudgetCategories,
  tripEvents,
  tripExpenseShares,
  tripExpenses,
  tripMembers,
  tripRecord,
  tripSegments,
  tripStops,
  tripTravellers,
} from '../../core/offline/trip-queries'
import { countKey } from '../../domain/count-key'
import { formatDayDate } from '../../domain/day-date'
import { toDomainEvents } from '../../domain/event-instants'
import { localToday } from '../../domain/local-today'
import { formatMoney, mixesCurrencies } from '../../domain/money'
import { recapCard, type RecapCardRow } from '../../domain/recap-card'
import { regionName } from '../../domain/region-name'
import { passportInput } from '../../domain/travel-history'
import { MkBarChartComponent, type ChartBar } from '../../shared/ui/bar-chart/bar-chart.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkGridComponent } from '../../shared/ui/layout/grid.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkMapComponent } from '../../shared/ui/map/map.component'
import { MkMascotComponent } from '../../shared/ui/mascot/mascot.component'
import { MkRouteChipComponent } from '../../shared/ui/route-chip/route-chip.component'
import { MkSegmentedComponent } from '../../shared/ui/segmented/segmented.component'
import { stampArtworkName } from '../../shared/ui/stamp/stamp-artwork'
import { MkStampTileComponent } from '../../shared/ui/stamp/stamp-tile.component'
import { MkStatRowComponent } from '../../shared/ui/stat-tile/stat-row.component'
import { MkStatTileComponent } from '../../shared/ui/stat-tile/stat-tile.component'
import { MkSwitchComponent } from '../../shared/ui/switch/switch.component'
import { MkTableComponent, type TableColumn, type TableRow } from '../../shared/ui/table/table.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import type { MapPlace, MapRoute } from '../../shared/ui/world-map/world-map.component'
import { RECAP_IMAGE } from './recap-image'
import { provideRecapI18n } from './recap-i18n'

interface StatTile {
  id: string
  eyebrow: string
  value: string
  sub?: string
}

interface TripStampView {
  key: string
  code: string
  place: string
  date: string
  arrivedBy: ArrivalMode | null
}

type SpendingView = 'chart' | 'table'

const CATEGORY_KEYS = [
  'categories.accommodation',
  'categories.transport',
  'categories.food',
  'categories.activities',
  'categories.shopping',
  'categories.other',
  'money.uncategorised',
  'money.chart',
  'money.table',
] as const

/**
 * The recap of a trip, read from the device so it opens offline: Kiko
 * celebrating once the trip is over ("so far" before that), the route,
 * the headline numbers, where we slept, the stamps this trip earned, the
 * map, spending by category (bars with a table view) and, in split mode,
 * who owes whom. "Save as image" draws a card on the device and shares or
 * downloads it, money left out unless the member turns it on; the expenses
 * CSV comes from the server, so it needs a connection.
 */
@Component({
  selector: 'app-recap-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    MkStackComponent,
    MkRowComponent,
    MkGridComponent,
    MkSectionComponent,
    MkTextComponent,
    MkButtonComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkEmptyStateComponent,
    MkMascotComponent,
    MkRouteChipComponent,
    MkStatRowComponent,
    MkStatTileComponent,
    MkListComponent,
    MkListRowComponent,
    MkStampTileComponent,
    MkMapComponent,
    MkSegmentedComponent,
    MkBarChartComponent,
    MkTableComponent,
    MkSwitchComponent,
  ],
  providers: [provideRecapI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      <mk-row gap="1">
        <a
          mk-icon-button
          [routerLink]="['/t', tripId(), 'summary']"
          [attr.aria-label]="'recap.back' | transloco"
          data-testid="recap.back"
        >
          <mk-icon name="arrow-left" />
        </a>
        <h1 mk-text variant="title" data-testid="recap.title">
          {{ (finished() ? 'recap.title' : 'recap.titleSoFar') | transloco }}
        </h1>
      </mk-row>

      @if (trip(); as trip) {
        <mk-row gap="2" align="start" data-testid="recap.hero" [attr.data-phase]="recap()?.phase">
          <mk-mascot
            [state]="finished() ? 'celebrating' : 'happy'"
            size="md"
            [label]="(finished() ? 'recap.mascot.celebrating' : 'recap.mascot.happy') | transloco"
            data-testid="recap.mascot"
          />
          <mk-stack gap="half">
            <h2 mk-text variant="heading" data-testid="recap.tripName">{{ trip.name }}</h2>
            <p mk-text variant="caption" tone="ink-2">
              {{ 'recap.dates' | transloco: { start: day(trip.startDate), end: day(trip.endDate) } }}
            </p>
            <p mk-text variant="label" tone="ink-2" data-testid="recap.phase">
              {{ 'recap.phase.' + (recap()?.phase ?? 'upcoming') | transloco: phaseParams() }}
            </p>
          </mk-stack>
        </mk-row>

        @if (recap(); as recap) {
          @if (recap.empty) {
            <mk-empty-state
              mascot="asleep"
              [title]="'recap.empty.title' | transloco"
              [body]="'recap.empty.body' | transloco"
              data-testid="recap.empty"
            />
          } @else {
            @if (chips().length > 0) {
              <mk-section [eyebrow]="'recap.route' | transloco">
                <mk-row gap="1" [wrap]="true" data-testid="recap.route">
                  <mk-route-chip [stops]="chips()" size="display" />
                </mk-row>
              </mk-section>
            }

            <mk-section [eyebrow]="'recap.stats.label' | transloco">
              <mk-stack gap="2">
                @for (row of statRows(); track $index) {
                  <mk-stat-row data-testid="recap.stats">
                    @for (tile of row; track tile.id) {
                      <mk-stat-tile
                        [eyebrow]="tile.eyebrow"
                        [value]="tile.value"
                        [sub]="tile.sub"
                        [attr.data-testid]="'recap.stat.' + tile.id"
                      />
                    }
                  </mk-stat-row>
                }
                @if (recap.distanceKm !== null && recap.stopsWithoutCoordinates > 0) {
                  <p mk-text variant="caption" tone="ink-3" data-testid="recap.distanceSkipped">
                    {{
                      countKey('recap.stats.skipped', recap.stopsWithoutCoordinates)
                        | transloco: { count: recap.stopsWithoutCoordinates }
                    }}
                  </p>
                }
              </mk-stack>
            </mk-section>

            @if (nightRows().length > 0) {
              <mk-section [eyebrow]="'recap.nights.title' | transloco">
                <mk-list data-testid="recap.nights">
                  @for (night of nightRows(); track night.id) {
                    <mk-list-row
                      [icon]="night.icon"
                      [title]="night.title"
                      [value]="night.value"
                      [testId]="'recap.night.' + night.id"
                    />
                  }
                </mk-list>
              </mk-section>
            }

            <mk-section [eyebrow]="'recap.stamps.title' | transloco">
              @if (stamps().length === 0) {
                <p mk-text variant="caption" tone="ink-3" data-testid="recap.stamps.empty">
                  {{ 'recap.stamps.empty' | transloco }}
                </p>
              } @else {
                <mk-grid gap="1" column="md" data-testid="recap.stamps">
                  @for (stamp of stamps(); track stamp.key) {
                    <mk-stamp-tile
                      [code]="stamp.code"
                      [name]="stamp.place"
                      [isoDate]="stamp.date"
                      [arrivedBy]="stamp.arrivedBy"
                      [caption]="stamp.place"
                      [meta]="stampDay(stamp.date)"
                      [label]="
                        'recap.stamps.stamp' | transloco: { place: stamp.place, date: stampDay(stamp.date) }
                      "
                      data-testid="recap.stamp"
                    />
                  }
                </mk-grid>
              }
            </mk-section>

            @if (places().length > 0) {
              <mk-section [eyebrow]="'recap.map.title' | transloco">
                <mk-map
                  [places]="places()"
                  [routes]="routes()"
                  [countries]="recap.countries"
                  [online]="online()"
                  [label]="'recap.map.label' | transloco: { places: placeNames() }"
                  data-testid="recap.map"
                />
              </mk-section>
            }

            <mk-section [eyebrow]="'recap.money.title' | transloco">
              <mk-stack gap="2">
                <mk-stat-row data-testid="recap.money">
                  @for (tile of moneyTiles(); track tile.id) {
                    <mk-stat-tile
                      [eyebrow]="tile.eyebrow"
                      [value]="tile.value"
                      [sub]="tile.sub"
                      [attr.data-testid]="'recap.stat.' + tile.id"
                    />
                  }
                </mk-stat-row>
                @if (highlights().length > 0) {
                  <mk-list data-testid="recap.highlights">
                    @for (row of highlights(); track row.id) {
                      <mk-list-row
                        [icon]="row.icon"
                        [title]="row.title"
                        [meta]="row.meta"
                        [value]="row.value"
                        [testId]="'recap.highlight.' + row.id"
                      />
                    }
                  </mk-list>
                }
                @if (recap.spending.pendingFxCount > 0) {
                  <p mk-text variant="caption" tone="ink-3" data-testid="recap.pendingFx">
                    {{
                      countKey('recap.money.pending', recap.spending.pendingFxCount)
                        | transloco: { count: recap.spending.pendingFxCount }
                    }}
                  </p>
                }
                @if (recap.spending.settlementCount > 0) {
                  <p mk-text variant="caption" tone="ink-3" data-testid="recap.settlements">
                    {{
                      countKey('recap.money.settlements', recap.spending.settlementCount)
                        | transloco: { count: recap.spending.settlementCount }
                    }}
                  </p>
                }
              </mk-stack>
            </mk-section>

            <mk-section [eyebrow]="'recap.money.byCategory' | transloco">
              @if (bars().length === 0) {
                <p mk-text variant="caption" tone="ink-3" data-testid="recap.money.empty">
                  {{ 'recap.money.empty' | transloco }}
                </p>
              } @else {
                <mk-stack gap="2">
                  <mk-segmented
                    role="tablist"
                    [options]="spendingViews()"
                    [(value)]="spendingView"
                    [label]="'recap.money.viewLabel' | transloco"
                    testId="recap.money.view"
                  />
                  @if (spendingView() === 'table') {
                    <mk-table
                      [caption]="'recap.money.byCategory' | transloco"
                      [columns]="tableColumns()"
                      [rows]="tableRows()"
                      testId="recap.money.table"
                    />
                  } @else {
                    <mk-bar-chart [bars]="bars()" testId="recap.money.chart" />
                  }
                </mk-stack>
              }
            </mk-section>

            @if (balanceRows(); as rows) {
              <mk-section [eyebrow]="'recap.balances.title' | transloco">
                <mk-list data-testid="recap.balances">
                  @for (row of rows; track row.id) {
                    <mk-list-row
                      icon="user"
                      [title]="row.name"
                      [meta]="row.state"
                      [value]="row.value"
                      testId="recap.balance"
                    />
                  }
                </mk-list>
              </mk-section>
            }
          }
        }

        <mk-section [eyebrow]="'recap.share.title' | transloco">
          <mk-stack gap="2">
            <mk-switch
              [checked]="includeMoney()"
              (checkedChange)="includeMoney.set($event)"
              testId="recap.includeMoney"
            >
              {{ 'recap.share.includeMoney' | transloco }}
            </mk-switch>
            <p mk-text variant="caption" tone="ink-3">{{ 'recap.share.privacy' | transloco }}</p>
            <mk-row gap="1" [wrap]="true">
              <button
                mk-button
                type="button"
                [disabled]="saving()"
                data-testid="recap.saveImage"
                (click)="saveImage()"
              >
                <mk-icon name="image" [size]="18" />
                {{ (saving() ? 'recap.share.saving' : 'recap.share.save') | transloco }}
              </button>
              @if (online()) {
                <a
                  mk-button
                  variant="secondary"
                  [href]="csvHref()"
                  download
                  data-testid="recap.exportCsv"
                >
                  <mk-icon name="download" [size]="18" />
                  {{ 'recap.csv.action' | transloco }}
                </a>
              }
            </mk-row>
            @if (!online()) {
              <p mk-text variant="caption" tone="ink-3" data-testid="recap.csvOffline">
                {{ 'recap.csv.offline' | transloco }}
              </p>
            }
          </mk-stack>
        </mk-section>
      }
    </mk-stack>
  `,
})
export default class RecapPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly transloco = inject(TranslocoService)
  private readonly toasts = inject(ToastService)
  private readonly image = inject(RECAP_IMAGE)
  private readonly clock = inject(CLOCK)
  private readonly zone = inject(TIME_ZONE)
  protected readonly online = inject(OnlineStore).online
  private readonly locale = intlLocale()
  private readonly words = scopedLabels('recap', CATEGORY_KEYS)

  protected readonly trip = tripRecord(this.tripId)
  private readonly stops = tripStops(this.tripId)
  private readonly events = tripEvents(this.tripId)
  private readonly segments = tripSegments(this.tripId)
  private readonly expenses = tripExpenses(this.tripId)
  private readonly shares = tripExpenseShares(this.tripId)
  private readonly travellers = tripTravellers(this.tripId)
  private readonly members = tripMembers(this.tripId)
  private readonly categories = tripBudgetCategories(this.tripId)
  private readonly records = travelRecords()

  protected readonly includeMoney = signal(false)
  protected readonly saving = signal(false)
  protected readonly spendingView = signal<SpendingView>('chart')
  protected readonly countKey = countKey

  private readonly today = computed(() => {
    this.records()
    return localToday(this.clock(), this.zone)
  })

  private readonly ordered = computed(() =>
    sortedStops(this.stops()).sort(
      (a, b) =>
        a.position - b.position ||
        (a.arriveOn ?? '').localeCompare(b.arriveOn ?? '') ||
        a.name.localeCompare(b.name)
    )
  )

  /** The shared domain's recap, the same numbers on every device. */
  protected readonly recap = computed<TripRecap | null>(() => {
    const trip = this.trip()
    if (!trip) return null
    return tripRecap({
      trip: {
        startsOn: trip.startDate,
        endsOn: trip.endDate,
        baseCurrency: trip.baseCurrency,
        budgetTotalMinor: trip.budgetTotalMinor ?? null,
      },
      stops: this.ordered(),
      events: toDomainEvents(this.events(), this.segments()),
      expenses: this.expenses(),
      today: this.today(),
    })
  })

  protected readonly finished = computed(() => this.recap()?.finished === true)
  protected readonly chips = computed(() => routeChips(this.ordered()).map((chip) => chip.label))
  protected readonly csvHref = computed(() => `/api/v1/trips/${this.tripId()}/expenses.csv`)

  protected readonly phaseParams = computed(() => {
    const recap = this.recap()
    return { day: recap?.daysSoFar ?? 0, total: recap?.days ?? 0 }
  })

  private readonly base = computed(() => this.trip()?.baseCurrency ?? 'EUR')
  private readonly mixed = computed(() =>
    mixesCurrencies(
      this.base(),
      this.expenses().map((expense) => expense.currency)
    )
  )

  /** Days, nights, places and distance, then the ways we moved: no money here. */
  protected readonly statRows = computed<StatTile[][]>(() => {
    this.words()
    const recap = this.recap()
    if (!recap) return []
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`recap.${key}`, params)
    const number = (value: number) => new Intl.NumberFormat(this.locale()).format(value)
    const first: StatTile[] = [
      {
        id: 'days',
        eyebrow: t('stats.days'),
        value: number(recap.days),
        sub: recap.finished ? undefined : t('stats.daysSoFar', { count: recap.daysSoFar }),
      },
      { id: 'nights', eyebrow: t('stats.nights'), value: number(recap.nights) },
      { id: 'countries', eyebrow: t('stats.countries'), value: number(recap.countries.length) },
    ]
    const second: StatTile[] = [
      { id: 'cities', eyebrow: t('stats.cities'), value: number(recap.cities.length) },
      {
        id: 'distance',
        eyebrow: t('stats.distance'),
        value:
          recap.distanceKm === null
            ? t('stats.distanceUnknown')
            : t('stats.distanceValue', { km: number(recap.distanceKm) }),
        sub: recap.distanceKm === null ? undefined : t('stats.straightLine'),
      },
    ]
    const moving: StatTile[] = (
      [
        ['flights', recap.transport.flights],
        ['trains', recap.transport.trains],
        ['ferries', recap.transport.ferries],
      ] as const
    )
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ id, eyebrow: t(`stats.${id}`), value: number(count) }))
    return [first, second, ...(moving.length > 0 ? [moving] : [])]
  })

  protected readonly nightRows = computed(() => {
    this.words()
    const recap = this.recap()
    if (!recap) return []
    const icons = {
      hotel: 'bed',
      train: 'train-front',
      plane: 'plane',
      other: 'ship',
      uncovered: 'circle-alert',
    } as const
    return (Object.keys(icons) as (keyof typeof icons)[])
      .filter((id) => recap.nightsByKind[id] > 0)
      .map((id) => ({
        id,
        icon: icons[id],
        title: this.transloco.translate(`recap.nights.${id}`),
        value: new Intl.NumberFormat(this.locale()).format(recap.nightsByKind[id]),
      }))
  })

  /** The places this trip stamped in the passport: first earned here or visited again. */
  protected readonly stamps = computed<TripStampView[]>(() => {
    const id = this.tripId()
    const countries = passportStamps(passportInput({ ...this.records(), today: this.today() }))
    const onTrip = (visits: readonly { tripId: string; earned: boolean; date: string }[]) =>
      visits.find((visit) => visit.tripId === id && visit.earned)
    return countries.flatMap((country) => {
      const views: TripStampView[] = []
      const visit = onTrip(country.visits)
      if (visit) {
        views.push({
          key: country.code,
          code: country.code,
          place: regionName(country.code, this.locale(), stampArtworkName(country.code)),
          date: visit.date,
          arrivedBy: country.arrivedBy,
        })
      }
      for (const city of country.cities) {
        const cityVisit = onTrip(city.visits)
        if (cityVisit) {
          const code = `${country.code}-${city.name.toLocaleUpperCase()}`
          views.push({
            key: code,
            code,
            place: city.name,
            date: cityVisit.date,
            arrivedBy: city.arrivedBy,
          })
        }
      }
      return views
    })
  })

  protected readonly places = computed<MapPlace[]>(() => {
    const today = this.today()
    const finished = this.finished()
    return this.ordered().flatMap((stop) =>
      stop.lat !== null && stop.lng !== null
        ? [
            {
              lat: stop.lat,
              lng: stop.lng,
              label: stop.name,
              series: 1,
              earned: finished || (stop.departOn !== null && stop.departOn < today),
            },
          ]
        : []
    )
  })
  protected readonly routes = computed<MapRoute[]>(() => [
    { series: 1, points: this.places().map(({ lat, lng }) => ({ lat, lng })) },
  ])
  protected readonly placeNames = computed(() =>
    this.places()
      .map((place) => place.label)
      .join(', ')
  )

  protected readonly moneyTiles = computed<StatTile[]>(() => {
    this.words()
    const recap = this.recap()
    if (!recap) return []
    const { spending } = recap
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`recap.money.${key}`, params)
    const budget =
      spending.budgetMinor === null || spending.budgetLeftMinor === null
        ? { value: t('noBudget'), sub: undefined }
        : {
            value:
              spending.budgetLeftMinor < 0n
                ? t('budgetOver', { amount: this.money(-spending.budgetLeftMinor) })
                : t('budgetLeft', { amount: this.money(spending.budgetLeftMinor) }),
            sub: t('budgetOf', { amount: this.money(spending.budgetMinor) }),
          }
    return [
      { id: 'spent', eyebrow: t('spent'), value: this.money(spending.totalMinor) },
      {
        id: 'perDay',
        eyebrow: t('perDay'),
        value: spending.perDayMinor === null ? t('perDayNone') : this.money(spending.perDayMinor),
      },
      { id: 'budget', eyebrow: t('budget'), ...budget },
    ]
  })

  protected readonly highlights = computed(() => {
    this.words()
    const recap = this.recap()
    if (!recap) return []
    const { spending } = recap
    const rows: { id: string; icon: 'wallet' | 'globe'; title: string; meta?: string; value: string }[] =
      []
    if (spending.biggest) {
      const expense = this.expenses().find((row) => row.id === spending.biggest!.id)
      rows.push({
        id: 'biggest',
        icon: 'wallet',
        title: this.transloco.translate('recap.money.biggest'),
        meta: [expense?.description, this.categoryLabel(spending.biggest.categoryId)]
          .filter(Boolean)
          .join(' · '),
        value: this.money(spending.biggest.baseAmountMinor),
      })
    }
    if (spending.topLocalCurrency) {
      const minor = this.expenses()
        .filter(
          (row) =>
            row.kind !== 'settlement' &&
            row.currency.toUpperCase() === spending.topLocalCurrency &&
            row.baseAmountMinor !== null
        )
        .reduce((sum, row) => sum + BigInt(row.baseAmountMinor ?? 0), 0n)
      rows.push({
        id: 'topCurrency',
        icon: 'globe',
        title: this.transloco.translate('recap.money.topCurrency'),
        value: this.transloco.translate('recap.money.topCurrencyValue', {
          currency: spending.topLocalCurrency,
          amount: this.money(minor),
        }),
      })
    }
    return rows
  })

  protected readonly spendingViews = computed(() => [
    { id: 'chart', label: this.words()[7] },
    { id: 'table', label: this.words()[8] },
  ])

  private readonly categoryRows = computed(() => {
    this.words()
    const recap = this.recap()
    if (!recap) return []
    const total = recap.spending.byCategory.reduce((sum, row) => sum + row.spentMinor, 0n)
    const percent = new Intl.NumberFormat(this.locale(), { style: 'percent' })
    return recap.spending.byCategory.map((row) => ({
      id: row.categoryId ?? 'none',
      label: this.categoryLabel(row.categoryId),
      minor: row.spentMinor,
      text: this.money(row.spentMinor),
      share: total > 0n ? percent.format(Number((row.spentMinor * 1000n) / total) / 1000) : '',
    }))
  })

  /** Single series, no target: the bar is what each category took. */
  protected readonly bars = computed<ChartBar[]>(() =>
    this.categoryRows().map((row) => ({
      id: row.id,
      label: row.label,
      value: Number(row.minor),
      target: null,
      valueText: row.text,
      targetText: row.share,
    }))
  )

  protected readonly tableColumns = computed<TableColumn[]>(() => {
    this.words()
    return [
      { id: 'category', label: this.transloco.translate('recap.money.category') },
      { id: 'amount', label: this.transloco.translate('recap.money.amount'), align: 'end' },
      { id: 'share', label: this.transloco.translate('recap.money.share'), align: 'end' },
    ]
  })
  protected readonly tableRows = computed<TableRow[]>(() =>
    this.categoryRows().map((row) => ({
      id: row.id,
      cells: { category: row.label, amount: row.text, share: row.share },
    }))
  )

  /** Split mode only: each traveller's net, from the same shared function Money uses. */
  protected readonly balanceRows = computed(() => {
    this.words()
    const trip = this.trip()
    if (trip?.budgetMode !== 'split') return null
    const owner = this.members().find((member) => member.role === 'owner')
    const view = balances({
      travellers: this.travellers().map((row) => row.id),
      expenses: this.expenses(),
      shares: this.shares(),
      defaultPayerTravellerId:
        this.travellers().find((row) => owner && row.userId === owner.userId)?.id ?? null,
    })
    return view.balances.map((row) => {
      const state = row.netMinor > 0n ? 'getsBack' : row.netMinor < 0n ? 'owes' : 'settled'
      return {
        id: row.travellerId,
        name: String(
          this.travellers().find((traveller) => traveller.id === row.travellerId)?.displayName ??
            this.transloco.translate('recap.balances.someone')
        ),
        state: this.transloco.translate(`recap.balances.${state}`),
        value: this.money(row.netMinor < 0n ? -row.netMinor : row.netMinor),
      }
    })
  })

  protected day(isoDate: string): string {
    return formatDayDate(isoDate, this.locale())
  }

  protected stampDay(isoDate: string): string {
    return formatDayDate(isoDate, this.locale(), false, true)
  }

  protected async saveImage(): Promise<void> {
    const trip = this.trip()
    const recap = this.recap()
    if (!trip || !recap || this.saving()) return
    const flat = (rows: StatTile[]): RecapCardRow[] =>
      rows.map((tile) => ({ id: tile.id, label: tile.eyebrow, value: tile.value }))
    const card = recapCard({
      title: trip.name,
      dates: this.transloco.translate('recap.dates', {
        start: this.day(trip.startDate),
        end: this.day(trip.endDate),
      }),
      route: this.chips(),
      stats: flat(this.statRows().flat()).filter((row) => row.id !== 'cities'),
      money: flat(this.moneyTiles().filter((tile) => tile.id !== 'budget')),
      includeMoney: this.includeMoney(),
      finished: recap.finished,
      footer: this.transloco.translate('recap.share.footer'),
    })
    this.saving.set(true)
    try {
      const outcome = await this.image.share(card, `${slug(trip.name)}-recap.png`)
      if (outcome !== 'cancelled') {
        this.toasts.show({ message: this.transloco.translate(`recap.share.${outcome}`) })
      }
    } catch {
      this.toasts.show({ message: this.transloco.translate('recap.share.failed') })
    } finally {
      this.saving.set(false)
    }
  }

  private categoryLabel(categoryId: string | null): string {
    const words = this.words()
    if (categoryId === null) return words[6]
    const category = this.categories().find((row) => row.id === categoryId)
    if (!category) return words[6]
    const index = [
      'accommodation',
      'transport',
      'food',
      'activities',
      'shopping',
      'other',
    ].indexOf(category.key ?? '')
    return index >= 0 ? words[index]! : (category.name ?? words[6])
  }

  private money(minor: bigint): string {
    return formatMoney(minor, this.base(), this.locale(), { disambiguate: this.mixed() })
  }
}

/** An ASCII file name from the trip's name. */
function slug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'trip'
  )
}
