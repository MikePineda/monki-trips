import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import type { Trip } from '@monkitrips/shared'
import { SessionStore } from '../../core/session/session.store'
import { TRIP_ERROR_CODES } from '../../layouts/shell/shell-i18n'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../shared/ui/text/text.component'
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
    MkStackComponent,
    MkRowComponent,
    MkTextComponent,
    MkListComponent,
    MkListRowComponent,
    MkBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <mk-row gap="2" justify="between">
        <h1 mk-text variant="title">{{ 'shell.trips.title' | transloco }}</h1>
        @if (store.trips().length > 0) {
          <button
            mk-button
            variant="secondary"
            size="sm"
            type="button"
            data-testid="trips.create"
            (click)="createTrip()"
          >
            <mk-icon name="plus" [size]="18" />
            {{ 'shell.trips.create.action' | transloco }}
          </button>
        }
      </mk-row>
      @if (unverified()) {
        <mk-banner
          icon="circle-alert"
          [title]="'shell.trips.unverified' | transloco"
          data-testid="trips.unverified"
        >
          <a
            mkBannerAction
            mk-button
            variant="ghost"
            size="sm"
            routerLink="/verify-email"
            data-testid="trips.verify"
          >
            {{ 'shell.trips.verify' | transloco }}
          </a>
        </mk-banner>
      } @else if (store.failure(); as failure) {
        <mk-api-error [failure]="failure" scope="shell" [knownCodes]="codes" testId="trips.error" />
      }
      @if (store.trips().length === 0) {
        <mk-empty-state
          mascot="excited"
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
        <mk-list data-testid="trips.list">
          @for (trip of store.trips(); track trip.id) {
            <mk-list-row
              [title]="trip.name"
              [meta]="'shell.trips.dates' | transloco: { start: trip.startDate, end: trip.endDate }"
              [link]="['/t', trip.id, 'today']"
              testId="trips.item"
            />
          }
        </mk-list>
      }
    </mk-stack>
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
