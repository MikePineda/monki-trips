import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { formatMoney } from '../../../domain/money'
import { provideShellI18n } from '../../../layouts/shell/shell-i18n'
import { MkBannerComponent } from '../../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../../shared/ui/button/button.component'
import { MkConnectionStatusComponent } from '../../../shared/ui/connection-status/connection-status.component'
import { MkDeviceFrameComponent } from '../../../shared/ui/device-frame/device-frame.component'
import { MkFabComponent } from '../../../shared/ui/fab/fab.component'
import { MkIconButtonComponent } from '../../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../../shared/ui/icon/icon.component'
import { MkPageComponent } from '../../../shared/ui/layout/page.component'
import { MkRowComponent, MkRowGrowDirective } from '../../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../../shared/ui/list/list.component'
import { MkMascotComponent } from '../../../shared/ui/mascot/mascot.component'
import { MkTabBarComponent } from '../../../shared/ui/tab-bar/tab-bar.component'
import { MkTextComponent } from '../../../shared/ui/text/text.component'
import { MkTicketComponent } from '../../../shared/ui/ticket/ticket.component'
import { MkTopBarComponent } from '../../../shared/ui/top-bar/top-bar.component'
import { DEMO_TRIP } from '../demo-trip'
import { provideStyleguideI18n } from '../styleguide-i18n'
import { mockLocale } from './mock-locale'
import { mockTabs } from './mock-tabs'

/**
 * The Today screen (the sacred one), top to bottom, with synthetic data:
 * header with "Day N of M · city", connection and Kiko; the ticket; today's
 * documents with the print banner first; tonight; left today with the
 * weather beside it; the expense FAB; the tab bar.
 */
@Component({
  selector: 'app-mock-today',
  imports: [
    TranslocoPipe,
    MkDeviceFrameComponent,
    MkTopBarComponent,
    MkConnectionStatusComponent,
    MkMascotComponent,
    MkPageComponent,
    MkStackComponent,
    MkRowComponent,
    MkRowGrowDirective,
    MkSectionComponent,
    MkTextComponent,
    MkTicketComponent,
    MkButtonComponent,
    MkIconComponent,
    MkIconButtonComponent,
    MkBannerComponent,
    MkListComponent,
    MkListRowComponent,
    MkFabComponent,
    MkTabBarComponent,
  ],
  providers: [provideStyleguideI18n(), provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-device-frame [sheet]="false">
      <mk-top-bar
        mkFrameTop
        [title]="
          'styleguide.today.dayOf'
            | transloco: { day: trip.day, total: trip.totalDays, city: trip.city }
        "
      >
        <mk-connection-status mkTopBarStatus [status]="{ state: 'offline', count: 0 }" />
        <mk-mascot mkTopBarActions state="happy" size="sm" [motion]="motion()" />
      </mk-top-bar>

      <mk-page [tabBar]="true">
        <mk-stack gap="0">
          <mk-section [eyebrow]="'styleguide.today.next' | transloco">
            <mk-ticket
              [title]="trip.nextEvent.title"
              [time]="trip.nextEvent.time"
              [zone]="trip.nextEvent.zone"
              [countdown]="
                'styleguide.today.countdown'
                  | transloco
                    : {
                        hours: trip.nextEvent.countdown.hours,
                        minutes: trip.nextEvent.countdown.minutes,
                      }
              "
              [leaveAt]="trip.nextEvent.leaveAt"
              [route]="trip.nextEvent.route"
              [reference]="trip.nextEvent.reference"
            >
              <button mkTicketAction mk-button variant="secondary" size="sm" type="button">
                <mk-icon name="navigation" [size]="16" />
                {{ 'styleguide.today.directions' | transloco }}
              </button>
            </mk-ticket>
          </mk-section>

          <mk-section [eyebrow]="'styleguide.today.documents' | transloco">
            <mk-stack gap="1">
              <mk-banner
                tone="print"
                icon="printer"
                [title]="'styleguide.sample.bannerPrint' | transloco"
                [body]="
                  trip.printFirst.title +
                  ' · ' +
                  ('styleguide.today.pages' | transloco: { count: trip.printFirst.pages })
                "
              >
                <button mkBannerAction mk-button variant="ghost" size="sm" type="button">
                  {{ 'styleguide.sample.bannerPrinted' | transloco }}
                </button>
              </mk-banner>
              <mk-list>
                @for (doc of trip.documents; track doc.reference) {
                  <mk-list-row
                    icon="file-text"
                    [title]="doc.title"
                    [meta]="doc.reference + ' · PDF'"
                    [monoMeta]="true"
                    [status]="{
                      tone: 'good',
                      icon: 'circle-check',
                      label: 'styleguide.today.savedOffline' | transloco,
                    }"
                  />
                }
              </mk-list>
            </mk-stack>
          </mk-section>

          <mk-section [eyebrow]="'styleguide.today.tonight' | transloco">
            <mk-stack gap="half">
              <h2 mk-text variant="heading">{{ trip.tonight.name }}</h2>
              <mk-row gap="1" align="start">
                <mk-stack mkRowGrow gap="0">
                  <p mk-text variant="body-strong">{{ trip.tonight.address }}</p>
                  <p mk-text tone="ink-2" [attr.lang]="trip.tonight.addressLocalLang">
                    {{ trip.tonight.addressLocal }}
                  </p>
                </mk-stack>
                <button
                  mk-icon-button
                  tone="accent"
                  type="button"
                  [attr.aria-label]="'styleguide.today.copyAddress' | transloco"
                >
                  <mk-icon name="copy" />
                </button>
              </mk-row>
              <mk-row gap="2" [wrap]="true">
                <span mk-text variant="label" tone="ink-2">
                  <mk-icon name="moon" [size]="16" />
                  {{ 'styleguide.today.checkIn' | transloco: { time: trip.tonight.checkIn } }}
                </span>
                <span mk-text variant="label" tone="ink-2">
                  <mk-icon name="phone" [size]="16" />
                  {{ trip.tonight.phone }}
                </span>
                <span mkRowGrow></span>
                <button mk-button variant="ghost" size="sm" type="button">
                  {{ 'styleguide.today.directions' | transloco }}
                </button>
              </mk-row>
            </mk-stack>
          </mk-section>

          <mk-section [eyebrow]="'styleguide.today.leftToday' | transloco">
            <mk-row gap="2" align="start" justify="between">
              <mk-stack gap="0">
                <p mk-text variant="display">{{ leftToday() }}</p>
                <p mk-text variant="caption" tone="ink-2">{{ leftTodayBase() }}</p>
                <p mk-text variant="caption" tone="ink-3">
                  {{ 'styleguide.today.pending' | transloco: { count: trip.money.pendingCount } }}
                </p>
                <p mk-text variant="caption" tone="ink-2">
                  {{ 'styleguide.today.yesterday' | transloco: { amount: yesterday() } }}
                </p>
              </mk-stack>
              <mk-stack gap="0" align="end">
                <span mk-text variant="label">
                  <mk-icon name="cloud-rain" [size]="16" />
                  {{ 'styleguide.today.weather' | transloco: { degrees: trip.weather.degrees } }}
                </span>
                <span mk-text variant="caption" tone="ink-3">
                  {{ 'styleguide.today.weatherAge' | transloco: { hours: trip.weather.ageHours } }}
                </span>
              </mk-stack>
            </mk-row>
          </mk-section>
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
export class MockTodayComponent {
  /** The style guide's reduced-motion toggle. */
  readonly motion = input<'auto' | 'still'>('auto')

  protected readonly trip = DEMO_TRIP
  private readonly i18n = mockLocale()

  protected readonly tabs = computed(() => mockTabs(this.i18n.tabLabels(), 'today'))
  protected readonly leftToday = computed(() =>
    formatMoney(DEMO_TRIP.money.leftTodayMinor, DEMO_TRIP.localCurrency, this.i18n.locale())
  )
  protected readonly leftTodayBase = computed(() =>
    formatMoney(DEMO_TRIP.money.leftTodayBaseMinor, DEMO_TRIP.baseCurrency, this.i18n.locale())
  )
  protected readonly yesterday = computed(() =>
    formatMoney(DEMO_TRIP.money.yesterdayOverMinor, DEMO_TRIP.localCurrency, this.i18n.locale())
  )
}
