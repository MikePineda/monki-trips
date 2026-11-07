import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'

/** Stand-in for the activity feed (phase 2): the title and one honest sentence. */
@Component({
  selector: 'app-activity-placeholder-page',
  imports: [TranslocoPipe, MkStackComponent, MkTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <h1 mk-text variant="title" data-testid="trip.activity.title">
        {{ 'shell.trip.activity.title' | transloco }}
      </h1>
      <p mk-text tone="ink-2" data-testid="trip.activity.body">
        {{ 'shell.trip.activity.body' | transloco }}
      </p>
    </mk-stack>
  `,
})
export default class ActivityPlaceholderPage {}
