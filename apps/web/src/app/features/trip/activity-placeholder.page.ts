import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'

/** Stand-in for the activity feed (phase 2): the title and one honest sentence. */
@Component({
  selector: 'app-activity-placeholder-page',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1" data-testid="trip.activity.title">
      {{ 'shell.trip.activity.title' | transloco }}
    </h1>
    <p class="mt-3 text-sm text-ink-2" data-testid="trip.activity.body">
      {{ 'shell.trip.activity.body' | transloco }}
    </p>
  `,
})
export default class ActivityPlaceholderPage {}
