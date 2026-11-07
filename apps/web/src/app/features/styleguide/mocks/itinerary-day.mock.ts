import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { formatDayDate } from '../../../domain/day-date'
import { provideShellI18n } from '../../../layouts/shell/shell-i18n'
import { MkButtonComponent } from '../../../shared/ui/button/button.component'
import { MkConnectionStatusComponent } from '../../../shared/ui/connection-status/connection-status.component'
import { MkDeviceFrameComponent } from '../../../shared/ui/device-frame/device-frame.component'
import { MkEmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component'
import { MkFabComponent } from '../../../shared/ui/fab/fab.component'
import { MkIconComponent } from '../../../shared/ui/icon/icon.component'
import { MkPageComponent } from '../../../shared/ui/layout/page.component'
import { MkRowComponent } from '../../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkEventRowComponent } from '../../../shared/ui/list/event-row.component'
import { MkListComponent } from '../../../shared/ui/list/list.component'
import { MkRouteChipComponent } from '../../../shared/ui/route-chip/route-chip.component'
import { MkSegmentedComponent } from '../../../shared/ui/segmented/segmented.component'
import { MkTabBarComponent } from '../../../shared/ui/tab-bar/tab-bar.component'
import { MkTextComponent } from '../../../shared/ui/text/text.component'
import { MkTopBarComponent } from '../../../shared/ui/top-bar/top-bar.component'
import { DEMO_TRIP } from '../demo-trip'
import { provideStyleguideI18n } from '../styleguide-i18n'
import { mockLocale } from './mock-locale'
import { mockTabs } from './mock-tabs'

/**
 * Plan · Days: the segmented control, the date heading with "Day N of M",
 * the day's route chips, event rows with the 64 px mono time column
 * (lodging as check-out and check-in rows) and the honest "Free day" at
 * the end of the list as the compact empty state.
 */
@Component({
  selector: 'app-mock-itinerary-day',
  imports: [
    TranslocoPipe,
    MkDeviceFrameComponent,
    MkTopBarComponent,
    MkConnectionStatusComponent,
    MkPageComponent,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkSegmentedComponent,
    MkRouteChipComponent,
    MkListComponent,
    MkEventRowComponent,
    MkButtonComponent,
    MkIconComponent,
    MkEmptyStateComponent,
    MkFabComponent,
    MkTabBarComponent,
  ],
  providers: [provideStyleguideI18n(), provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-device-frame>
      <mk-top-bar
        mkFrameTop
        [title]="trip.name"
        backLink="/styleguide"
        [backLabel]="'shell.nav.back' | transloco"
      >
        <mk-connection-status mkTopBarStatus [status]="{ state: 'stale', count: 2 }" />
      </mk-top-bar>

      <mk-page [tabBar]="true">
        <mk-stack gap="2">
          <mk-segmented
            role="tablist"
            [options]="views()"
            [(value)]="view"
            [label]="'shell.tabs.plan' | transloco"
          />
          <mk-stack gap="half">
            <h1 mk-text variant="title">{{ dayHeading() }}</h1>
            <p mk-text variant="caption" tone="ink-2">
              {{ 'styleguide.day.title' | transloco: { day: trip.day, total: trip.totalDays } }}
            </p>
            <mk-row gap="1" [wrap]="true">
              @for (leg of legs; track $index) {
                <mk-route-chip [stops]="leg" />
              }
            </mk-row>
          </mk-stack>
          <mk-list>
            <mk-event-row
              [time]="trip.events[0].time"
              [zone]="trip.events[0].zone"
              icon="bed-double"
              [title]="('styleguide.day.checkOut' | transloco) + ' · ' + trip.events[0].title"
              [meta]="'styleguide.day.nightOf' | transloco: { night: 2, total: 2 }"
            />
            <mk-event-row
              [time]="trip.events[1].time"
              [zone]="trip.events[1].zone"
              icon="train-front"
              [title]="trip.events[1].title"
              [meta]="'styleguide.day.trainMeta' | transloco"
            >
              <button mkRowAction mk-button variant="ghost" size="sm" type="button">
                <mk-icon name="navigation" [size]="16" />
                {{ 'styleguide.today.directions' | transloco }}
              </button>
            </mk-event-row>
            <mk-event-row
              [time]="trip.events[2].time"
              [zone]="trip.events[2].zone"
              icon="ticket"
              [title]="'styleguide.day.museum' | transloco"
              [meta]="'styleguide.day.museumMeta' | transloco"
            />
            <mk-event-row
              [time]="trip.events[3].time"
              [zone]="trip.events[3].zone"
              icon="bed-double"
              [title]="('styleguide.day.checkIn' | transloco) + ' · ' + trip.events[3].title"
              [meta]="'styleguide.day.nightOf' | transloco: { night: 1, total: 3 }"
            />
          </mk-list>
          <mk-empty-state
            layout="compact"
            mascot="thinking"
            [title]="'styleguide.sample.emptyDayTitle' | transloco"
            [body]="'styleguide.sample.emptyDayBody' | transloco"
          >
            <button mkEmptyAction mk-button variant="secondary" size="sm" type="button">
              {{ 'styleguide.sample.emptyDayAction' | transloco }}
            </button>
          </mk-empty-state>
        </mk-stack>
      </mk-page>

      <button mkFrameFab mk-fab placement="static" type="button">
        <mk-icon name="plus" />
        {{ 'styleguide.sample.fab' | transloco }}
      </button>
      <mk-tab-bar
        mkFrameBottom
        placement="static"
        [tabs]="tabs()"
        [label]="'shell.tabs.label' | transloco"
      />
    </mk-device-frame>
  `,
})
export class MockItineraryDayComponent {
  protected readonly trip = DEMO_TRIP
  protected readonly legs = [DEMO_TRIP.stops.slice(0, 2), DEMO_TRIP.stops.slice(1, 3)]
  protected readonly view = signal('days')

  private readonly i18n = mockLocale()
  private readonly transloco = inject(TranslocoService)

  protected readonly tabs = computed(() => mockTabs(this.i18n.tabLabels(), 'plan'))
  protected readonly dayHeading = computed(() => formatDayDate('2027-05-12', this.i18n.locale()))
  protected readonly views = computed(() => {
    this.i18n.locale()
    return [
      { id: 'days', label: this.transloco.translate('styleguide.sample.segmentDays') },
      { id: 'stays', label: this.transloco.translate('styleguide.sample.segmentStays') },
    ]
  })
}
