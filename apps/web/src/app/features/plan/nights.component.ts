import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { intlLocale } from '../../core/i18n/intl-locale'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { countKey } from '../../domain/count-key'
import { formatDayDate } from '../../domain/day-date'
import type { NightRow, NightsView } from '../../domain/nights-view'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent, type RowStatus } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { EVENT_KIND_ICONS } from './events/event-kind-icon'

/**
 * Plan · Where we sleep: the `serious` banner while nights are uncovered,
 * the counts, then one row per night with what covers it (lodging, a
 * night on board, an override) or "No stay" with a "Find a stay" action
 * that opens the add-event sheet prefilled with lodging for that night.
 */
@Component({
  selector: 'app-nights',
  imports: [
    TranslocoPipe,
    MkStackComponent,
    MkTextComponent,
    MkBannerComponent,
    MkButtonComponent,
    MkListComponent,
    MkListRowComponent,
    MkEmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2" data-testid="plan.nights">
      @if (view().uncovered > 0) {
        <mk-banner
          tone="serious"
          role="alert"
          icon="octagon-alert"
          [title]="uncoveredKey() | transloco: { count: view().uncovered }"
          [body]="'plan.nights.uncoveredBody' | transloco"
          data-testid="plan.nights.uncovered"
        />
      }
      @if (view().rows.length === 0) {
        <mk-empty-state
          mascot="happy"
          [title]="'plan.nights.emptyTitle' | transloco"
          [body]="'plan.nights.emptyBody' | transloco"
          data-testid="plan.nights.empty"
        />
      } @else {
        <p mk-text variant="caption" tone="ink-2" data-testid="plan.nights.counts">
          {{ key('nights', view().rows.length) | transloco: { count: view().rows.length } }} ·
          {{ key('lodging', view().lodging) | transloco: { count: view().lodging } }} ·
          {{ key('onTheWay', view().onTheWay) | transloco: { count: view().onTheWay } }}
        </p>
        <mk-list>
          @for (row of view().rows; track row.date) {
            <mk-list-row
              [icon]="iconOf(row)"
              [title]="night(row.date)"
              [meta]="'plan.nights.nightOf' | transloco: { night: row.number, total: row.total }"
              [value]="coverText(row)"
              valueKind="text"
              [status]="row.uncovered ? noStay() : undefined"
              [link]="
                row.covers[0] ? ['/t', tripId(), 'plan', 'e', row.covers[0].eventId] : undefined
              "
              testId="plan.night"
            >
              <ng-container ngProjectAs="[mkRowTrailing]">
                @if (row.uncovered) {
                  <button
                    mk-button
                    variant="secondary"
                    size="sm"
                    type="button"
                    data-testid="plan.night.findStay"
                    (click)="findStay.emit(row.date)"
                  >
                    {{ 'plan.nights.findStay' | transloco }}
                  </button>
                }
              </ng-container>
            </mk-list-row>
          }
        </mk-list>
      }
    </mk-stack>
  `,
})
export class NightsComponent {
  readonly tripId = input.required<string>()
  readonly view = input.required<NightsView>()
  readonly findStay = output<string>()

  private readonly locale = intlLocale()
  /** "No stay" and "On board", re-emitted when the language or its catalogue arrives. */
  private readonly words = scopedLabels('plan', ['nights.noStay', 'nights.onBoard'])

  protected readonly uncoveredKey = computed(
    () => `plan.nights.${countKey('uncovered', this.view().uncovered)}`
  )
  protected readonly noStay = computed<RowStatus>(() => ({
    tone: 'serious',
    icon: 'octagon-alert',
    label: this.words()[0] ?? '',
  }))

  protected key(base: 'nights' | 'lodging' | 'onTheWay', count: number): string {
    return `plan.nights.${countKey(base, count)}`
  }

  protected night(date: string): string {
    return formatDayDate(date, this.locale())
  }

  protected iconOf(row: NightRow) {
    const cover = row.covers[0]
    return cover ? EVENT_KIND_ICONS[cover.kind] : undefined
  }

  protected coverText(row: NightRow): string | undefined {
    if (row.covers.length === 0) {
      return undefined
    }
    return row.covers
      .map((cover) =>
        cover.kind === 'lodging' || cover.how === 'override'
          ? cover.title
          : `${this.words()[1] ?? ''} · ${cover.title}`
      )
      .join(', ')
  }
}
