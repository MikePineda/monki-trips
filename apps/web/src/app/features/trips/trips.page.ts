import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'

/**
 * The trip list. Phase 0 has no trips yet, so it shows an honest empty state
 * (no button for a feature that does not exist).
 */
@Component({
  selector: 'app-trips-page',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'shell.trips.title' | transloco }}</h1>
    <section
      class="mt-6 rounded-lg border border-line bg-surface-1 px-4 py-8 text-center"
      data-testid="trips.empty"
    >
      <h2 class="font-medium text-ink-1">{{ 'shell.trips.emptyTitle' | transloco }}</h2>
      <p class="mt-2 text-sm text-ink-2">{{ 'shell.trips.emptyBody' | transloco }}</p>
    </section>
  `,
})
export default class TripsPage {}
