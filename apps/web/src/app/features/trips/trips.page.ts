import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { TripsStore } from './trips.store'

/**
 * The trip list, read from the device's copy. Empty = an honest empty
 * state with no button for a feature that does not exist yet (creating a
 * trip arrives with phase 1).
 */
@Component({
  selector: 'app-trips-page',
  imports: [RouterLink, TranslocoPipe, MkEmptyStateComponent, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'shell.trips.title' | transloco }}</h1>
    @if (store.trips().length === 0) {
      <mk-empty-state
        class="mt-6 rounded-lg border border-line bg-surface-1"
        icon="plane"
        [title]="'shell.trips.emptyTitle' | transloco"
        [body]="'shell.trips.emptyBody' | transloco"
        data-testid="trips.empty"
      />
    } @else {
      <ul class="mt-4 divide-y divide-line" data-testid="trips.list">
        @for (trip of store.trips(); track trip.id) {
          <li>
            <a
              [routerLink]="['/t', trip.id, 'today']"
              class="flex items-center gap-3 py-3 text-ink-1"
              [attr.data-testid]="'trips.item'"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">{{ trip.name }}</span>
                <span class="block text-sm tabular-nums text-ink-2">{{
                  'shell.trips.dates' | transloco: { start: trip.startDate, end: trip.endDate }
                }}</span>
              </span>
              <mk-icon name="chevron-right" class="text-ink-3" />
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export default class TripsPage {
  protected readonly store = inject(TripsStore)
}
