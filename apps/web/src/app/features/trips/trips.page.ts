import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import type { Trip } from '@monkitrips/shared'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { TRIP_ERROR_CODES } from '../../layouts/shell/shell-i18n'
import { CreateTripSheet } from './create-trip.sheet'
import { TripsStore } from './trips.store'

/**
 * The trip list: the device's copy at once, refreshed from `GET /trips`
 * when online. Empty = an honest empty state with the one action that
 * exists: create the first trip. An unverified e-mail shows the way to
 * verify it; any other failure sits above the saved data.
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-ink-1">{{ 'shell.trips.title' | transloco }}</h1>
      @if (store.trips().length > 0) {
        <button
          mk-button
          variant="secondary"
          type="button"
          data-testid="trips.create"
          (click)="createTrip()"
        >
          <mk-icon name="plus" [size]="18" />
          {{ 'shell.trips.create.action' | transloco }}
        </button>
      }
    </div>
    @if (unverified()) {
      <div
        class="mt-4 flex flex-col gap-3 rounded-lg border border-status-warning bg-surface-1 p-4 text-sm text-ink-1"
        role="status"
        data-testid="trips.unverified"
      >
        <span>{{ 'shell.trips.unverified' | transloco }}</span>
        <a mk-button variant="secondary" routerLink="/verify-email" data-testid="trips.verify">
          {{ 'shell.trips.verify' | transloco }}
        </a>
      </div>
    } @else if (store.failure(); as failure) {
      <mk-api-error
        class="mt-4"
        [failure]="failure"
        scope="shell"
        [knownCodes]="codes"
        testId="trips.error"
      />
    }
    @if (store.trips().length === 0) {
      <mk-empty-state
        class="mt-6 rounded-lg border border-line bg-surface-1"
        icon="plane"
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
  private readonly session = inject(SessionStore)
  private readonly sheets = inject(SheetService)
  private readonly router = inject(Router)

  protected readonly codes = TRIP_ERROR_CODES
  /** The server refused the list because the address is not verified yet. */
  protected readonly unverified = computed(
    () => this.store.failure()?.is('E_EMAIL_NOT_VERIFIED') === true || !this.session.emailVerified()
  )

  constructor() {
    void this.store.refresh()
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
