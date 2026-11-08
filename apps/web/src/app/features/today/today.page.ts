import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import type { DocumentTag, MascotState, WeatherCondition } from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { CLOCK } from '../../core/offline/clock'
import { DocumentCopiesStore } from '../../core/offline/document-copies.store'
import { DocumentsStore } from '../../core/offline/documents.store'
import { OnlineStore } from '../../core/offline/online.store'
import { SyncService } from '../../core/offline/sync.service'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { TripContentStore } from '../../core/offline/trip-content.store'
import {
  tripEvents,
  tripExpenses,
  tripPhraseCards,
  tripRecord,
  tripSegments,
  tripStops,
  tripTasks,
  tripWeather,
} from '../../core/offline/trip-queries'
import { WeatherStore } from '../../core/offline/weather'
import { countKey } from '../../domain/count-key'
import { countdownKey, countdownParts } from '../../domain/countdown'
import { formatDayDate } from '../../domain/day-date'
import { directionsUrl } from '../../domain/directions-link'
import { fromBaseMinor, localRate } from '../../domain/local-money'
import { formatMoney } from '../../domain/money'
import { isIosUserAgent } from '../../domain/platform'
import { relativeTime } from '../../domain/relative-time'
import { telHref } from '../../domain/tel-href'
import { todayDocuments, todayMascot, todayScreen } from '../../domain/today-screen'
import { localClock, zoneLabel } from '../../domain/zoned-time'
import { languageForCountry } from '../../domain/phrase-card-languages'
import { tonightAddressCard } from '../../domain/tonight-address-card'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import type { IconName } from '../../shared/ui/icon/icon-names'
import { MkRowComponent, MkRowGrowDirective } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent, type RowStatus } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkMascotComponent } from '../../shared/ui/mascot/mascot.component'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { MkTicketComponent } from '../../shared/ui/ticket/ticket.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { provideTodayI18n } from './today-i18n'

/** The countdown moves on every half minute. */
const TICK_MS = 30_000

const WEATHER_ICONS: Record<WeatherCondition, IconName> = {
  clear: 'sun',
  partly_cloudy: 'cloud-sun',
  cloudy: 'cloud',
  fog: 'cloud-fog',
  drizzle: 'cloud-drizzle',
  rain: 'cloud-rain',
  thunderstorm: 'cloud-lightning',
  snow: 'snowflake',
}

interface DocumentLine {
  id: string
  title: string
  print: boolean
  /** The open print task the band ticks; null once printed (or before the server made it). */
  printTaskId: string | null
  meta: string
  status: RowStatus
}

/**
 * Today, the screen of the trip itself, top to bottom: the day and the
 * mascot; the next event as a ticket with its countdown and "Leave at";
 * the documents of the day with the print band first; tonight's stay;
 * what is left to spend today; the cached weather. The trip shell floats
 * the expense button above it.
 * Everything comes from the device through the shared pipelines, so the
 * screen works the same with no network. Before the trip it previews
 * day 1.
 */
@Component({
  selector: 'app-today-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    MkBannerComponent,
    MkButtonComponent,
    MkEmptyStateComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkListComponent,
    MkListRowComponent,
    MkMascotComponent,
    MkRowComponent,
    MkRowGrowDirective,
    MkSectionComponent,
    MkSkeletonComponent,
    MkStackComponent,
    MkTextComponent,
    MkTicketComponent,
  ],
  providers: [provideTodayI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (screen(); as screen) {
      <mk-stack gap="0" data-testid="today">
        <mk-section [hairline]="false">
          <mk-row gap="1" align="center">
            <mk-stack mkRowGrow gap="0">
              <h1 mk-text variant="title" data-testid="today.day">
                @if (screen.view.dayNumber; as day) {
                  @if (screen.view.stop; as stop) {
                    {{
                      'today.dayOfAt'
                        | transloco: { day: day, total: screen.view.totalDays, stop: stop.name }
                    }}
                  } @else {
                    {{ 'today.dayOf' | transloco: { day: day, total: screen.view.totalDays } }}
                  }
                } @else {
                  {{ 'today.over' | transloco }}
                }
              </h1>
              @if (screen.preview) {
                <p mk-text variant="caption" tone="ink-2" data-testid="today.preview">
                  {{ 'today.preview' | transloco: { date: day(trip()?.startDate) } }}
                </p>
              } @else if (screen.view.phase === 'past') {
                <p mk-text variant="caption" tone="ink-2">
                  {{ 'today.overBody' | transloco: { date: day(trip()?.endDate) } }}
                </p>
              }
            </mk-stack>
            <mk-mascot
              size="sm"
              [state]="mascot()"
              [label]="mascotLabel(mascot()) | transloco"
              data-testid="today.mascot"
            />
          </mk-row>
        </mk-section>

        <mk-section [eyebrow]="'today.next.label' | transloco" data-testid="today.next">
          @if (ticket(); as ticket) {
            <mk-ticket
              [title]="ticket.title"
              [time]="ticket.time"
              [zone]="ticket.zone ?? undefined"
              [countdown]="ticket.countdownKey | transloco: ticket.countdown"
              [leaveAt]="ticket.leaveAt"
              [route]="ticket.route"
              [reference]="ticket.reference ?? undefined"
            >
              @if (ticket.directions; as href) {
                <a
                  mkTicketAction
                  mk-button
                  variant="secondary"
                  size="sm"
                  target="_blank"
                  rel="noopener"
                  [href]="href"
                  data-testid="today.next.directions"
                >
                  <mk-icon name="navigation" [size]="16" />
                  {{ 'today.next.directions' | transloco }}
                </a>
              }
            </mk-ticket>
          } @else {
            <mk-empty-state
              layout="compact"
              mascot="happy"
              mascotSize="sm"
              [title]="'today.next.emptyTitle' | transloco"
              [body]="'today.next.emptyBody' | transloco"
              data-testid="today.next.empty"
            >
              <a
                mkEmptyAction
                mk-button
                variant="secondary"
                size="sm"
                [routerLink]="['/t', tripId(), 'plan']"
              >
                {{ 'today.next.openPlan' | transloco }}
              </a>
            </mk-empty-state>
          }
        </mk-section>

        @if (documents().length > 0) {
          <mk-section [eyebrow]="'today.documents.label' | transloco" data-testid="today.documents">
            <mk-stack gap="1">
              @for (doc of documents(); track doc.id) {
                @if (doc.print && doc.printTaskId) {
                  <mk-banner
                    tone="print"
                    icon="printer"
                    [title]="'today.documents.print' | transloco"
                    [body]="doc.title"
                    data-testid="today.print"
                  >
                    <button
                      mkBannerAction
                      mk-button
                      variant="ghost"
                      size="sm"
                      type="button"
                      data-testid="today.print.done"
                      (click)="markPrinted(doc.printTaskId)"
                    >
                      {{ 'today.documents.printed' | transloco }}
                    </button>
                  </mk-banner>
                }
              }
              <mk-list>
                @for (doc of documents(); track doc.id) {
                  <mk-list-row
                    icon="file-text"
                    [title]="doc.title"
                    [meta]="doc.meta"
                    [status]="doc.status"
                    [link]="['/t', tripId(), 'docs', doc.id]"
                    testId="today.document"
                  />
                }
              </mk-list>
            </mk-stack>
          </mk-section>
        }

        <mk-section [eyebrow]="'today.tonight.label' | transloco" data-testid="today.tonight">
          @if (screen.view.tonight; as tonight) {
            <mk-stack gap="half">
              <h2 mk-text variant="heading" data-testid="today.tonight.name">
                {{ tonight.placeName || tonight.title }}
              </h2>
              @if (tonight.how === 'transport') {
                <p mk-text tone="ink-2">{{ 'today.tonight.onBoard' | transloco }}</p>
              }
              @if (tonight.address || tonight.addressLocal) {
                <mk-row gap="1" align="start">
                  <mk-stack mkRowGrow gap="0">
                    @if (tonight.address; as address) {
                      <p mk-text variant="heading" data-testid="today.tonight.address">
                        {{ address }}
                      </p>
                    }
                    @if (tonight.addressLocal; as local) {
                      <p mk-text tone="ink-2" data-testid="today.tonight.addressLocal">
                        {{ local }}
                      </p>
                    }
                  </mk-stack>
                  <button
                    mk-icon-button
                    tone="accent"
                    type="button"
                    [attr.aria-label]="'today.tonight.copy' | transloco"
                    data-testid="today.tonight.copy"
                    (click)="copy(tonight.address || tonight.addressLocal || '')"
                  >
                    <mk-icon name="copy" />
                  </button>
                </mk-row>
              }
              <mk-row gap="2" [wrap]="true">
                <span mk-text variant="label" tone="ink-2" data-testid="today.tonight.checkIn">
                  <mk-icon name="moon" [size]="16" />
                  {{
                    (tonight.how === 'lodging' ? 'today.tonight.checkIn' : 'today.tonight.departs')
                      | transloco: { time: clock(tonight.startsLocal) }
                  }}
                </span>
                @if (tonightPhone(); as phone) {
                  <a mk-text variant="label" tone="accent" [href]="phone.href">
                    <mk-icon name="phone" [size]="16" />
                    {{ phone.text }}
                  </a>
                }
                <span mkRowGrow></span>
                @if (driverCard(); as cardKey) {
                  <a
                    mk-button
                    variant="secondary"
                    size="sm"
                    [routerLink]="['..', 'more', 'phrases', 'show', cardKey]"
                    data-testid="today.tonight.showDriver"
                  >
                    <mk-icon name="car" [size]="16" />
                    {{ 'today.tonight.showDriver' | transloco }}
                  </a>
                }
                @if (tonightDirections(); as href) {
                  <a
                    mk-button
                    variant="ghost"
                    size="sm"
                    target="_blank"
                    rel="noopener"
                    [href]="href"
                    data-testid="today.tonight.directions"
                  >
                    {{ 'today.tonight.directions' | transloco }}
                  </a>
                }
              </mk-row>
            </mk-stack>
          } @else if (screen.view.tonightAlert) {
            <mk-banner
              tone="serious"
              role="alert"
              icon="octagon-alert"
              [title]="'today.tonight.alertTitle' | transloco"
              [body]="'today.tonight.alertBody' | transloco"
              data-testid="today.tonight.alert"
            >
              <a
                mkBannerAction
                mk-button
                variant="ghost"
                size="sm"
                [routerLink]="['/t', tripId(), 'plan', 'nights']"
              >
                {{ 'today.tonight.findStay' | transloco }}
              </a>
            </mk-banner>
          } @else {
            <mk-empty-state
              layout="compact"
              icon="bed-double"
              [title]="'today.tonight.lastDayTitle' | transloco"
              [body]="'today.tonight.lastDayBody' | transloco"
              data-testid="today.tonight.none"
            />
          }
        </mk-section>

        <mk-section [eyebrow]="'today.money.label' | transloco" data-testid="today.money">
          @if (money(); as money) {
            <mk-stack gap="0">
              <p mk-text variant="display" data-testid="today.money.hero">{{ money.hero }}</p>
              @if (money.base; as base) {
                <p mk-text variant="caption" tone="ink-2" data-testid="today.money.base">
                  {{ base }}
                </p>
              }
              @if (money.over; as over) {
                <p mk-text variant="caption" tone="ink-2" data-testid="today.money.over">
                  {{ 'today.money.overBy' | transloco: { amount: over } }}
                </p>
              }
              @if (screen.view.budget.pendingSyncCount > 0) {
                <p mk-text variant="caption" tone="ink-3" data-testid="today.money.pending">
                  {{
                    count('money.pending', screen.view.budget.pendingSyncCount)
                      | transloco: { count: screen.view.budget.pendingSyncCount }
                  }}
                </p>
              }
              @if (screen.view.budget.pendingFxCount > 0) {
                <p mk-text variant="caption" tone="ink-3">
                  {{
                    count('money.rate', screen.view.budget.pendingFxCount)
                      | transloco: { count: screen.view.budget.pendingFxCount }
                  }}
                </p>
              }
            </mk-stack>
          } @else if (screen.view.budget.budgetMinor === null) {
            <mk-empty-state
              layout="compact"
              icon="wallet"
              [title]="'today.money.noBudgetTitle' | transloco"
              [body]="'today.money.noBudgetBody' | transloco"
              data-testid="today.money.empty"
            />
          } @else {
            <mk-empty-state
              layout="compact"
              icon="wallet"
              [title]="'today.money.pastTitle' | transloco"
              [body]="'today.money.pastBody' | transloco"
            />
          }
        </mk-section>

        @if (weather(); as weather) {
          <mk-section data-testid="today.weather">
            <mk-stack gap="0">
              <mk-row gap="1" [wrap]="true">
                <span mk-text variant="label" data-testid="today.weather.summary">
                  <mk-icon [name]="weather.icon" [size]="16" />
                  @if (weather.degrees !== null) {
                    {{
                      'today.weather.now'
                        | transloco
                          : {
                              degrees: weather.degrees,
                              condition: (weather.conditionKey | transloco),
                            }
                    }}
                  } @else {
                    {{ weather.conditionKey | transloco }}
                  }
                </span>
                @if (weather.range; as range) {
                  <span mk-text variant="caption" tone="ink-2" data-testid="today.weather.range">
                    {{ 'today.weather.range' | transloco: range }}
                    @if (range.rain !== null) {
                      · {{ 'today.weather.rain' | transloco: { percent: range.rain } }}
                    }
                  </span>
                }
                <span mk-text variant="caption" tone="ink-3" data-testid="today.weather.age">
                  {{ 'today.weather.age' | transloco: { age: weather.age } }}
                </span>
              </mk-row>
              <p mk-text variant="caption" tone="ink-3" data-testid="today.weather.attribution">
                {{ 'today.weather.attribution' | transloco: { name: weather.source } }}
              </p>
            </mk-stack>
          </mk-section>
        }
      </mk-stack>
    } @else {
      <mk-skeleton mascot="thinking" [rows]="6" data-testid="today.loading" />
    }
  `,
})
export default class TodayPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly clockNow = inject(CLOCK)
  private readonly deviceZone = inject(TIME_ZONE)
  private readonly document = inject(DOCUMENT)
  private readonly documentsStore = inject(DocumentsStore)
  private readonly content = inject(TripContentStore)
  private readonly toasts = inject(ToastService)
  private readonly weatherStore = inject(WeatherStore)
  private readonly online = inject(OnlineStore).online
  private readonly locale = intlLocale()
  private readonly words = scopedLabels('today', [
    'documents.saved',
    'documents.missing',
    'documents.printThis',
    'documents.showOnPhone',
    'documents.passport',
    'tonight.copied',
  ])

  protected readonly trip = tripRecord(this.tripId)
  private readonly stops = tripStops(this.tripId)
  private readonly events = tripEvents(this.tripId)
  private readonly segments = tripSegments(this.tripId)
  private readonly copies = inject(DocumentCopiesStore).copies
  private readonly tasks = tripTasks(this.tripId)
  private readonly expenses = tripExpenses(this.tripId)
  private readonly phraseSets = tripPhraseCards(this.tripId)

  /** "Now", moved on by a timer so the countdown ticks; read from CLOCK. */
  private readonly now = signal(this.clockNow())

  protected readonly screen = computed(() => {
    const trip = this.trip()
    if (!trip) {
      return null
    }
    return todayScreen({
      trip,
      stops: this.stops(),
      events: this.events(),
      segments: this.segments(),
      tasks: this.tasks(),
      expenses: this.expenses(),
      now: this.now(),
      deviceZone: this.deviceZone,
    })
  })

  /** The "take me to this address" card of tonight's stay, for "Show to driver"; null without one. */
  protected readonly driverCard = computed(() => {
    const view = this.screen()?.view
    const tonight = view?.tonight
    if (!tonight || tonight.how !== 'lodging') {
      return null
    }
    return tonightAddressCard(
      this.phraseSets(),
      tonight,
      languageForCountry(view.stop?.countryCode)
    )
  })

  private readonly platform = computed(() => {
    const navigator = this.document.defaultView?.navigator
    return isIosUserAgent(navigator?.userAgent ?? '', navigator?.maxTouchPoints ?? 0)
      ? ('ios' as const)
      : ('other' as const)
  })

  protected readonly ticket = computed(() => {
    const next = this.screen()?.view.nextEvent
    if (!next) {
      return null
    }
    const event = this.events().find((row) => row.id === next.eventId)
    const parts = countdownParts(next.countdownMs)
    const atMs = Date.parse(next.startsAt)
    return {
      title: next.title,
      time: localClock(next.startsLocal),
      zone: next.tz ? zoneLabel(next.tz, atMs, this.deviceZone, this.locale()) : null,
      countdownKey: `today.countdown.${countdownKey(parts)}`,
      countdown: {
        days: parts.days,
        hours: parts.hours,
        minutes: String(parts.minutes).padStart(2, '0'),
      },
      leaveAt: localClock(next.leaveAtLocal),
      route: next.route ? [next.route.from, next.route.to] : [],
      reference: event?.bookingCode ?? null,
      directions: event ? directionsUrl(this.platform(), event) : null,
    }
  })

  /** The day Today shows (day 1 before the trip): the vault picks its documents. */
  private readonly shownDate = computed(() => this.screen()?.view.today ?? '')
  private readonly cachedWeather = tripWeather(this.tripId, this.shownDate)
  private readonly needed = this.documentsStore.documentsNeededToday(this.tripId, this.shownDate)
  private readonly todayDocs = computed(() => todayDocuments(this.needed(), this.copies()))

  protected readonly mascot = computed(() => {
    const screen = this.screen()
    return screen ? todayMascot(screen, this.todayDocs()) : 'happy'
  })

  protected readonly documents = computed<DocumentLine[]>(() => {
    const screen = this.screen()
    if (!screen) {
      return []
    }
    const [saved, missing, printThis, showOnPhone, passport] = this.words()
    const reasonWords: Record<DocumentTag, string> = {
      print: printThis ?? '',
      show_on_phone: showOnPhone ?? '',
      requires_passport: passport ?? '',
    }
    return this.todayDocs().map((doc) => ({
      id: doc.id,
      title: doc.title,
      print: doc.reasons.includes('print'),
      printTaskId: screen.printTasks[doc.id] ?? null,
      meta: doc.reasons.map((reason) => reasonWords[reason]).join(' · '),
      status: doc.availableOffline
        ? { tone: 'good', icon: 'circle-check', label: saved ?? '' }
        : { tone: 'warning', icon: 'cloud-off', label: missing ?? '' },
    }))
  })

  protected readonly tonightDirections = computed(() => {
    const tonight = this.screen()?.view.tonight
    const event = tonight ? this.events().find((row) => row.id === tonight.eventId) : undefined
    return event ? directionsUrl(this.platform(), event) : null
  })

  protected readonly tonightPhone = computed(() => {
    const phone = this.screen()?.view.tonight?.phone
    const href = telHref(phone)
    return phone && href ? { text: phone, href } : null
  })

  protected readonly money = computed(() => {
    const screen = this.screen()
    const trip = this.trip()
    const left = screen?.view.budget.leftTodayMinor
    if (!screen || !trip || left === null || left === undefined) {
      return null
    }
    const locale = this.locale()
    const base = trip.baseCurrency
    const rate = localRate(this.expenses(), base, screen.view.stop?.countryCode)
    // Two currencies on one line need the disambiguated symbol (A$, MX$).
    const options = { disambiguate: rate !== null }
    const local = (baseMinor: bigint) =>
      rate
        ? formatMoney(fromBaseMinor(baseMinor, base, rate), rate.currency, locale, options)
        : formatMoney(baseMinor, base, locale, options)
    const hero = local(left)
    const baseText = formatMoney(left, base, locale, options)
    const over = left < 0n ? local(-left) : null
    return { hero, base: rate ? baseText : null, over }
  })

  /** The cached weather of the day Today shows: now (or the day's sky), max/min, rain, age. */
  protected readonly weather = computed(() => {
    const screen = this.screen()
    const weather = this.cachedWeather()
    if (!screen || !weather || weather.date !== screen.view.today) {
      return null
    }
    const day = weather.daily.find((entry) => entry.date === weather.date) ?? null
    const condition = weather.current?.condition ?? day?.condition
    if (!condition) {
      return null
    }
    return {
      icon: WEATHER_ICONS[condition],
      conditionKey: `today.weather.conditions.${condition}`,
      degrees: weather.current ? Math.round(weather.current.temperatureC) : null,
      range: day
        ? {
            max: Math.round(day.maxC),
            min: Math.round(day.minC),
            rain: day.precipitationProbabilityPct,
          }
        : null,
      age: relativeTime({
        instant: weather.updatedAt,
        now: screen.view.now,
        timeZone: screen.view.tz,
        locale: this.locale(),
      }),
      source: weather.attribution.name,
    }
  })

  constructor() {
    inject(SyncService).requestSync()
    const timer = setInterval(() => this.now.set(this.clockNow()), TICK_MS)
    inject(DestroyRef).onDestroy(() => clearInterval(timer))
    // Online, the day's weather is read once per visit; offline the cached copy shows with its age.
    let asked = ''
    effect(() => {
      const date = this.shownDate()
      if (!date || asked === date || !this.online()) {
        return
      }
      asked = date
      void this.weatherStore.refresh(this.tripId(), date)
    })
  }

  protected day(date: string | undefined): string {
    return date ? formatDayDate(date, this.locale()) : ''
  }

  protected clock(local: string): string {
    return localClock(local)
  }

  protected count(base: string, count: number): string {
    return `today.${countKey(base, count)}`
  }

  protected mascotLabel(state: MascotState): string {
    return `today.mascot.${state}`
  }

  /** "I printed it": the print task is ticked through the outbox, like any other change. */
  protected async markPrinted(taskId: string | null): Promise<void> {
    if (!taskId) {
      return
    }
    await this.content.upsert({
      tripId: this.tripId(),
      entity: 'task',
      id: taskId,
      changes: { doneAt: this.clockNow() },
    })
  }

  protected async copy(text: string): Promise<void> {
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(text)
      this.toasts.show({ message: this.words()[5] ?? '' })
    } catch {
      // No clipboard (http, permissions): the address stays on screen to select by hand.
    }
  }
}
