import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { intlLocale } from '../../core/i18n/intl-locale'
import { DEVICE_TIME_ZONE } from '../../core/offline/device-zone'
import { formatDayDate } from '../../domain/day-date'
import type { DayItem, ItineraryDay } from '../../domain/itinerary-days'
import { zoneLabel } from '../../domain/zoned-time'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkEventRowComponent } from '../../shared/ui/list/event-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkRouteChipComponent } from '../../shared/ui/route-chip/route-chip.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { EVENT_KIND_ICONS } from './events/event-kind-icon'

/**
 * Plan · Days: one section per local date with "Day N of M", the day's
 * route chips and the event rows (local time, zone when it differs from
 * the device, title, meta, "Directions"); an empty day is an honest "Free
 * day" with one action. Tapping a row opens the event detail.
 */
@Component({
  selector: 'app-days',
  imports: [
    TranslocoPipe,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkButtonComponent,
    MkIconComponent,
    MkRouteChipComponent,
    MkListComponent,
    MkEventRowComponent,
    MkEmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2" data-testid="plan.days">
      @for (day of days(); track day.date) {
        <mk-section [attr.data-testid]="'plan.day'" [attr.data-date]="day.date">
          <mk-stack gap="1">
            <mk-stack gap="half">
              <h2 mk-text variant="heading" data-testid="plan.day.title">
                {{ dayTitle(day.date) }}
              </h2>
              <p mk-text variant="caption" tone="ink-2">
                @if (day.dayNumber !== null) {
                  {{ 'plan.days.dayOf' | transloco: { day: day.dayNumber, total: total() } }}
                } @else {
                  {{ 'plan.days.outside' | transloco }}
                }
              </p>
              @if (day.chips.length > 0) {
                <mk-row gap="1" [wrap]="true" data-testid="plan.day.chips">
                  @for (chip of day.chips; track $index) {
                    <mk-route-chip [stops]="chip" />
                  }
                </mk-row>
              }
            </mk-stack>
            @if (day.items.length > 0) {
              <mk-list>
                @for (item of day.items; track item.key) {
                  <mk-event-row
                    [time]="item.time ?? ('plan.days.allDay' | transloco)"
                    [zone]="zone(item)"
                    [icon]="icons[item.kind]"
                    [title]="
                      (prefixKey(item) ? (prefixKey(item)! | transloco) + ' · ' : '') + item.title
                    "
                    [meta]="
                      item.night
                        ? ('plan.days.nightOf'
                          | transloco: { night: item.night.number, total: item.night.total })
                        : routeMeta(item)
                    "
                    [badge]="
                      item.syncState ? ('plan.days.' + item.syncState | transloco) : undefined
                    "
                    [tone]="
                      item.status === 'cancelled' || item.status === 'idea' ? 'muted' : 'default'
                    "
                    [link]="['/t', tripId(), 'plan', 'e', item.eventId]"
                    testId="plan.event"
                  >
                    @if (directions()[item.eventId]; as href) {
                      <a
                        mkRowAction
                        mk-button
                        variant="ghost"
                        size="sm"
                        [href]="href"
                        target="_blank"
                        rel="noopener"
                        data-testid="plan.event.directions"
                      >
                        <mk-icon name="navigation" [size]="16" />
                        {{ 'plan.days.directions' | transloco }}
                      </a>
                    }
                  </mk-event-row>
                }
              </mk-list>
            } @else {
              <mk-empty-state
                layout="compact"
                mascot="thinking"
                [title]="'plan.days.freeTitle' | transloco"
                [body]="'plan.days.freeBody' | transloco"
                data-testid="plan.day.free"
              >
                <button
                  mkEmptyAction
                  mk-button
                  variant="secondary"
                  size="sm"
                  type="button"
                  data-testid="plan.day.add"
                  (click)="addEvent.emit(day.date)"
                >
                  {{ 'plan.days.add' | transloco }}
                </button>
              </mk-empty-state>
            }
          </mk-stack>
        </mk-section>
      }
    </mk-stack>
  `,
})
export class DaysComponent {
  readonly tripId = input.required<string>()
  readonly days = input.required<ItineraryDay[]>()
  /** Directions href per event id, for the rows that have somewhere to go. */
  readonly directions = input<Record<string, string>>({})
  readonly addEvent = output<string>()

  private readonly deviceZone = inject(DEVICE_TIME_ZONE)
  private readonly locale = intlLocale()

  protected readonly icons = EVENT_KIND_ICONS
  protected readonly total = computed(
    () => this.days().filter((day) => day.dayNumber !== null).length
  )

  protected dayTitle(date: string): string {
    return formatDayDate(date, this.locale())
  }

  protected zone(item: DayItem): string | undefined {
    if (!item.zone || item.atMs === null) {
      return undefined
    }
    return zoneLabel(item.zone, item.atMs, this.deviceZone, this.locale()) ?? undefined
  }

  /** The catalogue key of the word before a lodging or arrival row's title. */
  protected prefixKey(item: DayItem): string | null {
    switch (item.role) {
      case 'check-in':
        return 'plan.days.checkIn'
      case 'check-out':
        return 'plan.days.checkOut'
      case 'arrival':
        return 'plan.days.arrives'
      default:
        return null
    }
  }

  protected routeMeta(item: DayItem): string | undefined {
    const parts = [item.route?.join(' → '), item.carrier].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : undefined
  }
}
