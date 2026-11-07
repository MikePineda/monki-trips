import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'

/**
 * A trip that does not exist for this person. Someone else's trip and a
 * deleted one look the same from here: "not found", never "forbidden" (the
 * trip is the tenant boundary and the API answers 404 for both).
 */
@Component({
  selector: 'app-trip-not-found-page',
  imports: [RouterLink, TranslocoPipe, MkButtonComponent, MkEmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-empty-state
      class="rounded-lg border border-line bg-surface-1"
      icon="map-pin"
      [title]="'shell.notFound.title' | transloco"
      [body]="'shell.notFound.body' | transloco"
      data-testid="trips.notFound"
    >
      <a
        mkEmptyAction
        mk-button
        variant="secondary"
        routerLink="/trips"
        data-testid="trips.notFound.back"
      >
        {{ 'shell.notFound.back' | transloco }}
      </a>
    </mk-empty-state>
  `,
})
export default class TripNotFoundPage {}
