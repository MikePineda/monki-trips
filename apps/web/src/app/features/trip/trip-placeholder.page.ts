import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'

export type TripSection = 'today' | 'plan' | 'docs' | 'money' | 'add'

/**
 * Stand-in for a trip tab until its package lands: the tab's title and one
 * sentence saying which phase brings it. `section` comes from route data.
 */
@Component({
  selector: 'app-trip-placeholder-page',
  imports: [TranslocoPipe, MkStackComponent, MkTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <h1 mk-text variant="title" [attr.data-testid]="'trip.' + section() + '.title'">
        {{ 'shell.trip.' + section() + '.title' | transloco }}
      </h1>
      <p mk-text tone="ink-2">{{ 'shell.trip.' + section() + '.body' | transloco }}</p>
    </mk-stack>
  `,
})
export default class TripPlaceholderPage {
  readonly section = input.required<TripSection>()
}
