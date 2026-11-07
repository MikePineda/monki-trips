import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import type { IconName } from '../../shared/ui/icon/icon-names'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'

interface MoreItem {
  id:
    | 'summary'
    | 'tasks'
    | 'checklist'
    | 'emergency'
    | 'members'
    | 'activity'
    | 'settings'
    | 'offline'
  icon: IconName
}

/** The "More" tab: a plain list of the trip's secondary screens. */
@Component({
  selector: 'app-more-page',
  imports: [TranslocoPipe, MkStackComponent, MkListComponent, MkListRowComponent, MkTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <h1 mk-text variant="title">{{ 'shell.trip.more.title' | transloco }}</h1>
      <mk-list data-testid="trip.more.list">
        @for (item of items; track item.id) {
          <mk-list-row
            [icon]="item.icon"
            [title]="'shell.trip.more.' + item.id | transloco"
            [link]="item.id === 'summary' ? ['..', 'summary'] : item.id"
            [testId]="'trip.more.' + item.id"
          />
        }
      </mk-list>
    </mk-stack>
  `,
})
export default class MorePage {
  protected readonly items: readonly MoreItem[] = [
    { id: 'summary', icon: 'info' },
    { id: 'tasks', icon: 'list-checks' },
    { id: 'checklist', icon: 'clipboard-check' },
    { id: 'emergency', icon: 'siren' },
    { id: 'members', icon: 'users' },
    { id: 'activity', icon: 'activity' },
    { id: 'settings', icon: 'settings' },
    { id: 'offline', icon: 'wifi-off' },
  ]
}
