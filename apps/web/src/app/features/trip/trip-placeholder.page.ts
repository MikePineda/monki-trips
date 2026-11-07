import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'

export type TripSection = 'today' | 'plan' | 'docs' | 'money' | 'add'

/**
 * Stand-in for a trip tab until its package lands: the tab's title and one
 * sentence saying which phase brings it. `section` comes from route data.
 */
@Component({
  selector: 'app-trip-placeholder-page',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1
      class="text-xl font-semibold text-ink-1"
      [attr.data-testid]="'trip.' + section() + '.title'"
    >
      {{ 'shell.trip.' + section() + '.title' | transloco }}
    </h1>
    <p class="mt-3 text-sm text-ink-2">{{ 'shell.trip.' + section() + '.body' | transloco }}</p>
  `,
})
export default class TripPlaceholderPage {
  readonly section = input.required<TripSection>()
}
