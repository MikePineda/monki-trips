import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import type { IconName } from '../../shared/ui/icon/icon-names'

interface MoreItem {
  id: 'members' | 'activity' | 'settings' | 'offline'
  icon: IconName
}

/** The "More" tab: a plain list of the trip's secondary screens. */
@Component({
  selector: 'app-more-page',
  imports: [RouterLink, TranslocoPipe, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'shell.trip.more.title' | transloco }}</h1>
    <ul class="mt-4 divide-y divide-line" data-testid="trip.more.list">
      @for (item of items; track item.id) {
        <li>
          <a
            [routerLink]="item.id"
            class="flex items-center gap-3 py-3 text-ink-1"
            [attr.data-testid]="'trip.more.' + item.id"
          >
            <mk-icon [name]="item.icon" class="text-ink-3" />
            <span class="flex-1">{{ 'shell.trip.more.' + item.id | transloco }}</span>
            <mk-icon name="chevron-right" class="text-ink-3" />
          </a>
        </li>
      }
    </ul>
  `,
})
export default class MorePage {
  protected readonly items: readonly MoreItem[] = [
    { id: 'members', icon: 'users' },
    { id: 'activity', icon: 'activity' },
    { id: 'settings', icon: 'settings' },
    { id: 'offline', icon: 'wifi-off' },
  ]
}
