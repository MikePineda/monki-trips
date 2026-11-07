import { ChangeDetectionStrategy, Component, computed } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { formatDayDate } from '../../../domain/day-date'
import { provideShellI18n } from '../../../layouts/shell/shell-i18n'
import { MkConnectionStatusComponent } from '../../../shared/ui/connection-status/connection-status.component'
import { MkDeviceFrameComponent } from '../../../shared/ui/device-frame/device-frame.component'
import { MkIconButtonComponent } from '../../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../../shared/ui/icon/icon.component'
import { MkPageComponent } from '../../../shared/ui/layout/page.component'
import { MkRowComponent } from '../../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../../shared/ui/list/list.component'
import { MkStampComponent } from '../../../shared/ui/stamp/stamp.component'
import { MkTextComponent } from '../../../shared/ui/text/text.component'
import { MkTopBarComponent } from '../../../shared/ui/top-bar/top-bar.component'
import { DEMO_TRIP } from '../demo-trip'
import { provideStyleguideI18n } from '../styleguide-i18n'
import { mockLocale } from './mock-locale'

/**
 * The trip list: ongoing, upcoming and past trips as rows, and the
 * passport stamps of a finished trip as the reward.
 */
@Component({
  selector: 'app-mock-trips',
  imports: [
    TranslocoPipe,
    MkDeviceFrameComponent,
    MkTopBarComponent,
    MkConnectionStatusComponent,
    MkIconComponent,
    MkIconButtonComponent,
    MkPageComponent,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkListComponent,
    MkListRowComponent,
    MkStampComponent,
  ],
  providers: [provideStyleguideI18n(), provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-device-frame>
      <mk-top-bar mkFrameTop [title]="'app.name' | transloco">
        <mk-connection-status mkTopBarStatus [status]="{ state: 'pending', count: 1 }" />
        <a
          mkTopBarActions
          mk-icon-button
          href="#"
          [attr.aria-label]="'shell.nav.settings' | transloco"
        >
          <mk-icon name="settings" />
        </a>
      </mk-top-bar>

      <mk-page>
        <mk-stack gap="2">
          <h1 mk-text variant="title">{{ 'styleguide.trips.title' | transloco }}</h1>
          @for (group of groups(); track group.state) {
            <mk-section [eyebrow]="'styleguide.trips.' + group.state | transloco">
              <mk-list>
                @for (trip of group.trips; track trip.id) {
                  <mk-list-row
                    [title]="trip.name"
                    [meta]="trip.dates"
                    [value]="trip.value"
                    [link]="['/styleguide']"
                  />
                }
              </mk-list>
            </mk-section>
          }
          <mk-section [eyebrow]="'styleguide.trips.stamps' | transloco">
            <mk-row gap="2" justify="center" [wrap]="true">
              @for (stamp of stamps(); track stamp.code) {
                <mk-stamp [code]="stamp.code" [name]="stamp.name" [date]="stamp.date" />
              }
            </mk-row>
          </mk-section>
        </mk-stack>
      </mk-page>
    </mk-device-frame>
  `,
})
export class MockTripsComponent {
  private readonly i18n = mockLocale()

  protected readonly groups = computed(() => {
    const locale = this.i18n.locale()
    const byState = (state: string) =>
      DEMO_TRIP.trips
        .filter((trip) => trip.state === state)
        .map((trip) => ({
          id: trip.id,
          name: trip.name,
          dates: `${formatDayDate(trip.start, locale, false)} – ${formatDayDate(trip.end, locale, false)}`,
          value: state === 'ongoing' ? `${DEMO_TRIP.day}/${DEMO_TRIP.totalDays}` : undefined,
        }))
    return ['ongoing', 'upcoming', 'past'].map((state) => ({ state, trips: byState(state) }))
  })

  protected readonly stamps = computed(() =>
    DEMO_TRIP.stamps.map((stamp) => ({
      ...stamp,
      date: formatDayDate(stamp.date, this.i18n.locale(), false),
    }))
  )
}
