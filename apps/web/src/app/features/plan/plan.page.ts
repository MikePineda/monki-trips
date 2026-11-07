import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  input,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router, RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { addDays } from '@monkitrips/shared'
import { filter, map, startWith } from 'rxjs'
import {
  tripEvents,
  tripRecord,
  tripSegments,
  tripStops,
  tripTravellers,
} from '../../core/offline/trip-queries'
import { directionsUrl } from '../../domain/directions-link'
import { itineraryDays } from '../../domain/itinerary-days'
import { nightsView } from '../../domain/nights-view'
import { isIosUserAgent } from '../../domain/platform'
import { MkFabComponent } from '../../shared/ui/fab/fab.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSegmentedComponent } from '../../shared/ui/segmented/segmented.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { DaysComponent } from './days.component'
import { EventFormSheet, type EventFormData, type EventPrefill } from './events/event-form.sheet'
import { provideEventsI18n } from './events/events-i18n'
import { NightsComponent } from './nights.component'
import { providePlanI18n } from './plan-i18n'

/** The two views of the Plan tab, by URL: `plan` and `plan/nights`. */
type PlanView = 'days' | 'nights'

/**
 * The Plan tab: the segmented control "Days | Where we sleep", the chosen
 * list below, the "Add event" FAB, and the router outlet through which
 * `plan/e/:eventId` opens the event detail as a sheet. Everything is read
 * live from the device; every write goes through the outbox.
 */
@Component({
  selector: 'app-plan-page',
  imports: [
    RouterOutlet,
    TranslocoPipe,
    MkStackComponent,
    MkTextComponent,
    MkSegmentedComponent,
    MkFabComponent,
    MkIconComponent,
    DaysComponent,
    NightsComponent,
  ],
  // The events scope loads with the tab, so the sheets open with their words even offline.
  providers: [providePlanI18n(), provideEventsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <h1 mk-text variant="title" data-testid="plan.title">{{ 'plan.title' | transloco }}</h1>
      <mk-segmented
        role="tablist"
        [options]="views()"
        [value]="view()"
        (valueChange)="show($event)"
        [label]="'plan.segments.label' | transloco"
        testId="plan.view"
      />
      @if (view() === 'nights') {
        <app-nights [tripId]="tripId()" [view]="nights()" (findStay)="findStay($event)" />
      } @else {
        <app-days
          [tripId]="tripId()"
          [days]="days()"
          [directions]="directions()"
          (addEvent)="addEvent({ startDate: $event })"
        />
      }
      <router-outlet />
    </mk-stack>
    <button mk-fab type="button" data-testid="plan.add" (click)="addEvent()">
      <mk-icon name="plus" />
      {{ 'plan.days.add' | transloco }}
    </button>
  `,
})
export default class PlanPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly router = inject(Router)
  private readonly sheets = inject(SheetService)
  private readonly document = inject(DOCUMENT)

  private readonly trip = tripRecord(this.tripId)
  private readonly stops = tripStops(this.tripId)
  private readonly events = tripEvents(this.tripId)
  private readonly segments = tripSegments(this.tripId)
  private readonly travellers = tripTravellers(this.tripId)

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  )
  protected readonly view = computed<PlanView>(() =>
    /\/plan\/nights(?:[/?#]|$)/.test(this.url()) ? 'nights' : 'days'
  )

  private readonly viewLabels = scopedLabels('plan', ['segments.days', 'segments.nights'])
  protected readonly views = computed(() => [
    { id: 'days', label: this.viewLabels()[0] ?? '' },
    { id: 'nights', label: this.viewLabels()[1] ?? '' },
  ])

  private readonly dates = computed(() => {
    const trip = this.trip()
    return trip ? { startsOn: trip.startDate, endsOn: trip.endDate } : null
  })

  protected readonly days = computed(() => {
    const dates = this.dates()
    return dates ? itineraryDays(dates, this.events(), this.segments(), this.stops()) : []
  })

  protected readonly nights = computed(() => {
    const dates = this.dates()
    return dates
      ? nightsView(dates, this.events(), this.segments())
      : { rows: [], lodging: 0, onTheWay: 0, uncovered: 0 }
  })

  protected readonly directions = computed(() => {
    const window = this.document.defaultView
    const platform = isIosUserAgent(
      window?.navigator.userAgent ?? '',
      window?.navigator.maxTouchPoints ?? 0
    )
      ? 'ios'
      : 'other'
    const links: Record<string, string> = {}
    for (const event of this.events()) {
      const href = directionsUrl(platform, event)
      if (href) {
        links[event.id] = href
      }
    }
    return links
  })

  protected show(view: string | undefined): void {
    void this.router.navigate([
      '/t',
      this.tripId(),
      'plan',
      ...(view === 'nights' ? ['nights'] : []),
    ])
  }

  /** "Find a stay": lodging for that night, check-in at 15:00 and check-out the next morning. */
  protected findStay(night: string): void {
    this.addEvent({
      kind: 'lodging',
      startDate: night,
      startTime: '15:00',
      endDate: addDays(night, 1),
      endTime: '11:00',
    })
  }

  protected addEvent(prefill: EventPrefill = {}): void {
    const trip = this.trip()
    if (!trip) {
      return
    }
    this.sheets.open<void, EventFormData>(EventFormSheet, {
      data: {
        tripId: this.tripId(),
        trip,
        stops: this.stops(),
        travellers: this.travellers(),
        prefill,
      },
    })
  }
}
